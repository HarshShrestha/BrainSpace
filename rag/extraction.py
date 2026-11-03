"""Conservative public-page retrieval with validated, pinned DNS on each hop."""

import http.client
import ipaddress
import re
import socket
import ssl
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from .errors import RagError

MAX_BYTES = 1_000_000
BLOCKED = {
    "script",
    "style",
    "noscript",
    "nav",
    "footer",
    "header",
    "form",
    "svg",
    "iframe",
}


def is_public_address(address):
    try:
        ip = ipaddress.ip_address(address)
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        return ip.is_global
    except ValueError:
        return False


class TextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag in BLOCKED:
            self.depth += 1

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in BLOCKED and self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if not self.depth:
            self.text.append(data)


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
        text = body.decode("utf-8", errors="replace")
        if ctype == "text/html":
            parser = TextParser()
            parser.feed(text)
            text = " ".join(parser.text)
        return re.sub(r"\s+", " ", text).strip()[:24000]
    raise RagError(422, "Too many redirects")
