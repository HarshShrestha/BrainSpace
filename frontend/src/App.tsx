import { useEffect, useState } from "react";
import { useRecoilState, useResetRecoilState } from "recoil";
import { api, ApiError, setUnauthorizedHandler } from "./services/api";
import { contentState, userState } from "./store/state";
import { Auth } from "./features/auth/Auth";
import { Workspace } from "./features/content/Workspace";
import { SharedPage } from "./features/share/SharedPage";
export default function App() {
  const [user, setUser] = useRecoilState(userState),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const resetContent = useResetRecoilState(contentState);
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      resetContent();
    });
  }, [setUser, resetContent]);
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
