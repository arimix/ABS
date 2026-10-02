import { useNavigate } from "react-router-dom";
import { useState } from "react";

export function Home() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");

  return (
    <div className="screen">
      <div className="hero-copy">
        <h1>No more "idk, you pick."</h1>
        <p>
          Send your friends a link. Everyone swipes real spots nearby — dinner's
          decided the second you all land on the same place. No group chat
          spiral required.
        </p>
      </div>
      <button className="btn btn-primary" onClick={() => navigate("/new")}>
        Start picking a spot
      </button>

      <div style={{ marginTop: 28 }}>
        <div className="field">
          <label htmlFor="join-code">Have a code?</label>
          <input
            id="join-code"
            type="text"
            placeholder="e.g. 7F3KQP"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={8}
          />
        </div>
        <button
          className="btn btn-secondary"
          disabled={!joinCode.trim()}
          onClick={() => navigate(`/s/${joinCode.trim()}`)}
        >
          Join session
        </button>
      </div>
    </div>
  );
}
