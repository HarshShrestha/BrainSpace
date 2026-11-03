"""Conservative public-page retrieval with validated, pinned DNS on each hop."""

import codecs
import http.client
import ipaddress
import re
import socket
import ssl
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from .errors import RagError

MAX_BYTES = 1_000_000
# Never readable text.
CODE = {"script", "style", "noscript", "template", "svg", "iframe"}
# Page chrome and form controls; dropped only while enough article text remains.
# <form> itself is not listed: some frameworks (e.g. ASP.NET WebForms) wrap the whole page in one.
BLOCKED = CODE | {"nav", "footer", "header", "select", "button", "textarea"}
MIN_TEXT = 80
# NAT64 prefixes embed an IPv4 destination in the low 32 bits.
NAT64 = (ipaddress.ip_network("64:ff9b::/96"), ipaddress.ip_network("64:ff9b:1::/48"))


def is_public_address(address):
    try:
        ip = ipaddress.ip_address(address)
        if isinstance(ip, ipaddress.IPv6Address):
            if ip.ipv4_mapped:
                ip = ip.ipv4_mapped
            elif any(ip in net for net in NAT64):
                ip = ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)
        return ip.is_global and not ip.is_multicast
    except ValueError:
        return False


class TextParser(HTMLParser):
    def __init__(self, blocked=BLOCKED):
        super().__init__(convert_charrefs=True)
        self.blocked = blocked
        self.depth = 0
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag in self.blocked:
            self.depth += 1

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in self.blocked and self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if not self.depth:
            self.text.append(data)


def clean(text):
    return re.sub(r"\s+", " ", text).strip()


def html_text(html):
    """Drop page chrome; if that leaves too little (e.g. an unclosed <header>), keep everything but code."""
    for blocked in (BLOCKED, CODE):
        parser = TextParser(blocked)
        parser.feed(html)
        parser.close()
        text = " ".join(parser.text)
        if len(clean(text)) >= MIN_TEXT:
            break
    return text


def charset(content_type):
    match = re.search(r"charset=[\"']?([\w.:-]+)", content_type or "", re.I)
    if match:
        try:
            return codecs.lookup(match.group(1)).name
        except LookupError:
            pass
    return "utf-8"


def fetch_public_text(source):
    current = source
    for _ in range(4):
        try:
            url = urlsplit(current)
            host = url.hostname
            port = url.port or (443 if url.scheme == "https" else 80)
            if (
                url.scheme not in ("http", "https")
                or not host
                or url.username is not None
                or url.password is not None
                or port != (443 if url.scheme == "https" else 80)
            ):
                raise ValueError()
            host = host.encode("idna").decode("ascii")
        except (ValueError, UnicodeError):
            raise RagError(
                400, "Only public HTTP(S) pages on standard ports can be indexed"
            ) from None
        try:
            addresses = {
                a[4][0] for a in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
            }
        except OSError:
            raise RagError(422, "Could not resolve the source page") from None
        if not addresses or any(not is_public_address(a) for a in addresses):
            raise RagError(
                400, "Private or reserved network addresses cannot be indexed"
            )
        # The socket connects directly to the validated IP; TLS still verifies the original hostname.
        conn = http.client.HTTPConnection(host, port, timeout=10)
        try:
            sock = socket.create_connection((sorted(addresses)[0], port), timeout=10)
            if url.scheme == "https":
                sock = ssl.create_default_context().wrap_socket(
                    sock, server_hostname=host
                )
            conn.sock = sock
            path = (url.path or "/") + (("?" + url.query) if url.query else "")
            conn.request(
                "GET",
                path,
                headers={
                    "Host": host,
                    "Accept": "text/html,text/plain;q=0.9",
                    "Accept-Encoding": "identity",
                    "User-Agent": "BrainSpaceIndexer/1.0",
                },
            )
            response = conn.getresponse()
            location = response.getheader("Location")
            if response.status in (301, 302, 303, 307, 308) and location:
                current = urljoin(current, location)
                continue
            if response.status < 200 or response.status >= 300:
                raise RagError(
                    422, "Source page is not publicly accessible; try pasting its text"
                )
            ctype = (
                (response.getheader("Content-Type") or "")
                .split(";", 1)[0]
                .strip()
                .lower()
            )
            if ctype not in ("text/html", "text/plain"):
                raise RagError(
                    422,
                    "Only HTML and plain-text pages can be read; paste a transcript or document text instead",
                )
            body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise RagError(422, "Source page is too large; try pasting its text")
        except RagError:
            raise
        except (OSError, http.client.HTTPException, ValueError):
            raise RagError(
                422, "Could not safely read the page; try pasting its text instead"
            ) from None
        finally:
            conn.close()
        text = body.decode(charset(response.getheader("Content-Type")), errors="replace")
        if ctype == "text/html":
            text = html_text(text)
        return clean(text)[:24000]
    raise RagError(422, "Too many redirects")
