import { useEffect, useState } from "react";
import { useRecoilState } from "recoil";
import { api, ApiError } from "./services/api";
import { userState } from "./store/state";
import { Auth } from "./features/auth/Auth";
import { Workspace } from "./features/content/Workspace";
import { SharedPage } from "./features/share/SharedPage";
export default function App() {
  const [user, setUser] = useRecoilState(userState),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const match = window.location.pathname.match(
    /^\/shared\/([A-Za-z0-9_-]+)\/?$/,
  );
  useEffect(() => {
    if (match) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    api
      .me()
      .then(setUser)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setUser(null);
        else setError(e instanceof Error ? e.message : "Could not connect");
      })
      .finally(() => setLoading(false));
  }, [attempt]);
  if (match) return <SharedPage token={match[1]} />;
  if (error)
    return (
      <main className="loading">
        <p role="alert">{error}</p>
        <button className="secondary" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </main>
    );
  if (loading)
    return (
      <main className="loading" role="status">
        Opening your space…
      </main>
    );
  return user ? <Workspace /> : <Auth />;
}
