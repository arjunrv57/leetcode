import { useState, useEffect, useCallback } from "react";

const LC_QUERY = `
  query getUserProfile($username: String!) {
    matchedUser(username: $username) {
      profile {
        ranking
        userAvatar
      }
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
      userCalendar {
        streak
        totalActiveDays
      }
      contestBadge {
        name
        icon
      }
      badges {
      id
        displayName
        icon
        creationDate
      }
    }
    userContestRanking(username: $username) {
      rating
      attendedContestsCount
      globalRanking
      totalParticipants
    }
    recentAcSubmissionList(username: $username, limit: 1) {
      timestamp
    }
  }
`;

const fetchLeetCodeData = async (username) => {
  const body = JSON.stringify({ query: LC_QUERY, variables: { username } });
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent("https://leetcode.com/graphql")}`;

  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
      Origin: "https://leetcode.com",
    },
    body,
  });

  if (!res.ok) throw new Error("Network error");

  const json = await res.json();
  const user = json?.data?.matchedUser;
  if (!user) throw new Error("User not found");

  const stats = user.submitStatsGlobal.acSubmissionNum;
  const get = (d) => stats.find((s) => s.difficulty === d)?.count ?? 0;

  // Today's progress from recent submission
  const recentTs = json?.data?.recentAcSubmissionList?.[0]?.timestamp;
  let todayProgress = 0;
  if (recentTs) {
    const sub = new Date(Number(recentTs) * 1000);
    const now = new Date();
    if (
      sub.getFullYear() === now.getFullYear() &&
      sub.getMonth() === now.getMonth() &&
      sub.getDate() === now.getDate()
    ) {
      todayProgress = 1;
    }
  }

  return {
    easy: get("Easy"),
    medium: get("Medium"),
    hard: get("Hard"),
    total: get("All"),
    avatar: user.profile?.userAvatar ?? null,
    ranking: user.profile?.ranking ?? null,
    rating: Math.round(json?.data?.userContestRanking?.rating ?? 0) || null,
    streak: user.userCalendar?.streak ?? 0,
    totalActiveDays: user.userCalendar?.totalActiveDays ?? 0,
    contestsCount: json?.data?.userContestRanking?.attendedContestsCount ?? 0,
    contestBadge: user.contestBadge ?? null,
    badges: user.badges ?? [],
    todayProgress,
  };
};

const INSTITUTES = ["Hitech", "Rathinam", "Jagannath"];
const INST_COLORS = {
  Hitech: { main: "#2563eb", light: "#2563eb12", border: "#2563eb55" },
  Rathinam: { main: "#0ea5e9", light: "#0ea5e912", border: "#0ea5e955" },
  Jagannath: { main: "#6366f1", light: "#6366f112", border: "#6366f155" },
};

const totalScore = (s) =>
  (s.easy ?? 0) * 1 + (s.medium ?? 0) * 3 + (s.hard ?? 0) * 5;
const totalSolved = (s) => (s.easy ?? 0) + (s.medium ?? 0) + (s.hard ?? 0);
const initials = (name) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const REFRESH_INTERVAL = 60 * 1000;

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  body { background:#f0f4ff; color:#0f172a; font-family:'Syne',sans-serif; min-height:100vh; }
  @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
  @keyframes fadeIn  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes popIn   { from{opacity:0;transform:scale(.92) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
  input,select,button { font-family:'Syne',sans-serif; }
  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:#e8eef8; }
  ::-webkit-scrollbar-thumb { background:#bcd0f0; border-radius:3px; }
`;

const LiveDot = () => (
  <span
    style={{
      display: "inline-block",
      width: 8,
      height: 8,
      background: "#2ecc71",
      borderRadius: "50%",
      marginRight: 6,
      animation: "pulse 1.4s infinite",
      verticalAlign: "middle",
    }}
  />
);

const Spinner = () => (
  <span
    style={{
      display: "inline-block",
      width: 14,
      height: 14,
      border: "2px solid #bcd0f0",
      borderTop: "2px solid #2563eb",
      borderRadius: "50%",
      animation: "spin .7s linear infinite",
    }}
  />
);

const Badge = ({ children, color }) => (
  <span
    style={{
      background: `${color}22`,
      color,
      border: `1px solid ${color}44`,
      borderRadius: 6,
      fontSize: 10,
      fontWeight: 700,
      padding: "2px 8px",
      letterSpacing: 1,
      fontFamily: "'JetBrains Mono',monospace",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

// ─── Profile Modal ──────────────────────────────────────────────────────────
const ProfileModal = ({ student, onClose }) => {
  const c = INST_COLORS[student.institute] || INST_COLORS.Hitech;
  const solved = totalSolved(student);

  const statBox = (value, label, color) => (
    <div
      style={{
        flex: 1,
        background: color ? `${color}12` : "#1a1a26",
        borderRadius: 12,
        padding: "1rem",
        textAlign: "center",
        border: `1px solid ${color ? color + "33" : "#2a2a40"}`,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: color || "#f0f0ff",
          fontFamily: "'JetBrains Mono',monospace",
        }}
      >
        {value ?? "—"}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#8888aa",
          marginTop: 4,
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
    </div>
  );

  const infoRow = (icon, label, value, valueColor) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: "1px solid #1e1e2e",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#aaaacc",
          fontSize: 14,
        }}
      >
        <span style={{ fontSize: 16 }}>{icon}</span> {label}
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: 14,
          fontFamily: "'JetBrains Mono',monospace",
          color: valueColor || "#f0f0ff",
        }}
      >
        {value}
      </div>
    </div>
  );

  const badges = student.badges ?? [];
  const contestBadge = student.contestBadge ?? null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000bb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#12121a",
          border: `1px solid ${c.border}`,
          borderRadius: 24,
          padding: "2rem",
          width: "100%",
          maxWidth: 460,
          animation: "popIn .25s ease",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            {student.avatar ? (
              <img
                src={student.avatar}
                alt={student.name}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  border: `3px solid ${c.main}`,
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: c.light,
                  border: `3px solid ${c.main}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 800,
                  color: c.main,
                  fontFamily: "'JetBrains Mono',monospace",
                }}
              >
                {initials(student.name)}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{student.name}</div>
            <div style={{ color: "#8888aa", fontSize: 13, marginTop: 2 }}>
              {student.institute} Institute
            </div>
            <span
              onClick={() =>
                window.open(
                  "https://leetcode.com/" + student.username,
                  "_blank",
                )
              }
              style={{
                fontSize: 12,
                color: c.main,
                cursor: "pointer",
                fontFamily: "'JetBrains Mono',monospace",
              }}
            >
              @{student.username} ↗
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #2a2a40",
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: "pointer",
              color: "#8888aa",
              fontSize: 16,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Total / Rating / Rank */}
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {statBox(solved, "TOTAL", null)}
          {statBox(student.rating || "—", "RATING", "#f39c12")}
          {statBox(
            student.ranking ? student.ranking.toLocaleString() : "—",
            "LC RANK",
            null,
          )}
        </div>

        {/* Easy / Medium / Hard */}
        <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
          {statBox(student.easy, "EASY", "#2ecc71")}
          {statBox(student.medium, "MEDIUM", "#f39c12")}
          {statBox(student.hard, "HARD", "#e74c3c")}
        </div>

        {/* Info rows */}
        {infoRow(
          "🔥",
          "Current Streak",
          `${student.streak ?? 0} days`,
          student.streak > 0 ? "#f39c12" : null,
        )}
        {infoRow("📅", "Active Days", student.totalActiveDays ?? 0)}
        {infoRow("🏆", "Contests Attended", student.contestsCount ?? 0)}

        {/* Contest Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 0",
            borderBottom: "1px solid #1e1e2e",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#aaaacc",
              fontSize: 14,
            }}
          >
            <span style={{ fontSize: 16 }}>🎯</span> Contest Badge
          </div>
          {contestBadge ? (
            <span
              style={{
                background: "#f39c1222",
                color: "#f39c12",
                border: "1px solid #f39c1244",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                fontFamily: "'JetBrains Mono',monospace",
              }}
            >
              {contestBadge.name}
            </span>
          ) : (
            <span style={{ color: "#555566", fontSize: 13 }}>None</span>
          )}
        </div>

        {/* Today's Progress */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 0",
            borderBottom: "1px solid #1e1e2e",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#aaaacc",
              fontSize: 14,
            }}
          >
            <span style={{ fontSize: 16 }}>📈</span> Today's Progress
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              fontFamily: "'JetBrains Mono',monospace",
              color: student.todayProgress > 0 ? "#2ecc71" : "#f0f0ff",
            }}
          >
            {student.todayProgress > 0 ? `+${student.todayProgress}` : "+0"}
          </div>
        </div>

        {/* Badges section */}
        <div style={{ marginTop: "1.2rem" }}>
          <div
            style={{
              fontSize: 11,
              color: "#8888aa",
              letterSpacing: 2,
              marginBottom: 10,
            }}
          >
            BADGES ({badges.length})
          </div>
          {badges.length === 0 ? (
            <div
              style={{
                color: "#555566",
                fontSize: 13,
                textAlign: "center",
                padding: "1rem 0",
              }}
            >
              No badges yet
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {badges.map((b) => (
                <div
                  key={b.id}
                  style={{
                    background: "#1a1a26",
                    border: "1px solid #2a2a40",
                    borderRadius: 8,
                    padding: "6px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {b.icon && (
                    <img
                      src={b.icon}
                      alt={b.displayName}
                      style={{ width: 20, height: 20, objectFit: "contain" }}
                      onError={(e) => (e.target.style.display = "none")}
                    />
                  )}
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#f0f0ff",
                      }}
                    >
                      {b.displayName || b.id}
                    </div>
                    {b.creationDate && (
                      <div style={{ fontSize: 10, color: "#555566" }}>
                        {b.creationDate}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InstCard = ({ institute, students }) => {
  const c = INST_COLORS[institute];
  const list = students.filter(
    (s) => s.institute === institute && s.status === "loaded",
  );
  const solved = list.reduce((a, s) => a + totalSolved(s), 0);
  const score = list.reduce((a, s) => a + totalScore(s), 0);
  return (
    <div
      style={{
        flex: 1,
        background: "#12121a",
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        padding: "1rem 1.2rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#8888aa",
          letterSpacing: 2,
          marginBottom: 4,
        }}
      >
        {institute.toUpperCase()}
      </div>
      <div
        style={{ fontSize: 30, fontWeight: 800, color: c.main, lineHeight: 1 }}
      >
        {solved}
      </div>
      <div style={{ fontSize: 10, color: "#8888aa", marginTop: 3 }}>
        solved · {score} pts
      </div>
      <div style={{ fontSize: 10, color: "#8888aa" }}>
        {list.length} students
      </div>
    </div>
  );
};

const AddModal = ({ onAdd, onClose }) => {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [institute, setInstitute] = useState("Hitech");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!username.trim() || !name.trim()) {
      setError("Name and username are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchLeetCodeData(username.trim());
      onAdd({
        id: Date.now(),
        name: name.trim(),
        username: username.trim(),
        institute,
        status: "loaded",
        lastFetch: new Date().toISOString(),
        ...data,
      });
      onClose();
    } catch (err) {
      setError(
        err.message === "User not found"
          ? "LeetCode username not found. Check spelling."
          : `Error: ${err.message}`,
      );
      setLoading(false);
    }
  };

  const inputStyle = {
    background: "#2563eb",
    border: "1px solid #2a2a40",
    borderRadius: 8,
    padding: "9px 12px",
    color: "#f0f0ff",
    fontSize: 14,
    outline: "none",
    width: "100%",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000cc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
      }}
    >
      <div
        style={{
          background: "#12121a",
          border: "1px solid #2a2a40",
          borderRadius: 20,
          padding: "2rem",
          width: 360,
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          animation: "fadeIn .2s ease",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>Add Student</div>
        <div style={{ fontSize: 12, color: "#8888aa" }}>
          Pulls real data directly from LeetCode profile.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#8888aa", letterSpacing: 1 }}>
            FULL NAME
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Arjun Sharma"
            style={inputStyle}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#8888aa", letterSpacing: 1 }}>
            LEETCODE USERNAME
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. arjun_codes"
            style={inputStyle}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#8888aa", letterSpacing: 1 }}>
            INSTITUTE
          </label>
          <select
            value={institute}
            onChange={(e) => setInstitute(e.target.value)}
            style={inputStyle}
          >
            {INSTITUTES.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </div>
        {error && (
          <div
            style={{
              background: "#e74c3c22",
              border: "1px solid #e74c3c55",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              color: "#e74c3c",
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 10,
              border: "1px solid #2a2a40",
              background: "transparent",
              color: "#8888aa",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 10,
              border: "none",
              background: loading ? "#2a2a40" : "#7c5cff",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <Spinner /> Fetching...
              </>
            ) : (
              "Add"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [students, setStudents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ll_students") || "[]");
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState("");
  const [filterInst, setFilterInst] = useState("All");
  const [sortBy, setSortBy] = useState("score");
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);
  const [profileStudent, setProfileStudent] = useState(null); // ← new

  useEffect(() => {
    localStorage.setItem("ll_students", JSON.stringify(students));
  }, [students]);

  const refreshAll = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      const updated = await Promise.all(
        students.map(async (s) => {
          try {
            const data = await fetchLeetCodeData(s.username);
            return {
              ...s,
              ...data,
              status: "loaded",
              lastFetch: new Date().toISOString(),
            };
          } catch {
            return { ...s, status: "error" };
          }
        }),
      );
      setStudents(updated);
      setLastRefresh(new Date());
      setCountdown(REFRESH_INTERVAL / 1000);
      if (!silent) setRefreshing(false);
    },
    [students],
  );

  useEffect(() => {
    if (students.length === 0) return;
    const interval = setInterval(() => refreshAll(true), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshAll, students.length]);

  useEffect(() => {
    if (students.length === 0) return;
    const tick = setInterval(
      () => setCountdown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => clearInterval(tick);
  }, [students.length]);

  const addStudent = useCallback((student) => {
    setStudents((prev) => [...prev, student]);
  }, []);

  const removeStudent = (id) => {
    if (window.confirm("Remove this student?"))
      setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const refreshOne = async (id) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "loading" } : s)),
    );
    const student = students.find((s) => s.id === id);
    try {
      const data = await fetchLeetCodeData(student.username);
      setStudents((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                ...data,
                status: "loaded",
                lastFetch: new Date().toISOString(),
              }
            : s,
        ),
      );
    } catch {
      setStudents((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "error" } : s)),
      );
    }
  };

  const filtered = students
    .filter(
      (s) =>
        (filterInst === "All" || s.institute === filterInst) &&
        (s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.username.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => {
      if (sortBy === "score") return totalScore(b) - totalScore(a);
      if (sortBy === "solved") return totalSolved(b) - totalSolved(a);
      if (sortBy === "hard") return (b.hard ?? 0) - (a.hard ?? 0);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

  const ranked = [...students].sort((a, b) => totalScore(b) - totalScore(a));
  const rankOf = (id) => ranked.findIndex((s) => s.id === id) + 1;

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  const instTotals = INSTITUTES.map((inst) => ({
    inst,
    solved: students
      .filter((s) => s.institute === inst && s.status === "loaded")
      .reduce((a, s) => a + totalSolved(s), 0),
  }));
  const maxSolved = Math.max(...instTotals.map((x) => x.solved), 1);

  const rankColors = ["#ffd166", "#c0c0d0", "#cd7c4a"];
  const rankEmoji = ["🥇", "🥈", "🥉"];

  return (
    <>
      <style>{CSS}</style>
      {showAdd && (
        <AddModal onAdd={addStudent} onClose={() => setShowAdd(false)} />
      )}
      {profileStudent && (
        <ProfileModal
          student={profileStudent}
          onClose={() => setProfileStudent(null)}
        />
      )}

      <div style={{ maxWidth: 940, margin: "0 auto", padding: "2rem 1rem" }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: "2rem",
            animation: "fadeIn .5s ease",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#ffffff",
              letterSpacing: 4,
              marginBottom: 6,
            }}
          >
            COMPETITIVE LEADERBOARD
          </div>
          <h1
            style={{
              fontSize: 52,
              fontWeight: 800,
              lineHeight: 1,
              marginBottom: 10,
              background: "linear-gradient(135deg,#7c5cff,#ff5c8a,#f39c12)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            LeetLeague
          </h1>
          <div
            style={{
              color: "#8888aa",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <span>
              <LiveDot />
              Live · auto-refresh every 1 min
            </span>
            {lastRefresh && (
              <span>Last: {lastRefresh.toLocaleTimeString()}</span>
            )}
            {students.length > 0 && (
              <span style={{ color: "#7c5cff" }}>
                Next in {mins}:{secs.toString().padStart(2, "0")}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginBottom: "1rem",
            animation: "fadeIn .6s ease",
          }}
        >
          {INSTITUTES.map((inst) => (
            <InstCard key={inst} institute={inst} students={students} />
          ))}
        </div>

        <div style={{ marginBottom: "2rem", animation: "fadeIn .7s ease" }}>
          {instTotals.map(({ inst, solved }) => {
            const c = INST_COLORS[inst];
            return (
              <div
                key={inst}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 80,
                    fontSize: 11,
                    color: c.main,
                    fontWeight: 700,
                  }}
                >
                  {inst}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    background: "#1a1a26",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 3,
                      background: c.main,
                      width: `${(solved / maxSolved) * 100}%`,
                      transition: "width 1s ease",
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 40,
                    textAlign: "right",
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono',monospace",
                    color: "#8888aa",
                  }}
                >
                  {solved}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: "1.5rem",
            animation: "fadeIn .8s ease",
          }}
        >
          <input
            placeholder="Search student or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: 180,
              background: "#12121a",
              border: "1px solid #2a2a40",
              borderRadius: 10,
              padding: "10px 14px",
              color: "#f0f0ff",
              fontSize: 14,
              outline: "none",
            }}
          />
          <select
            value={filterInst}
            onChange={(e) => setFilterInst(e.target.value)}
            style={{
              background: "#12121a",
              border: "1px solid #2a2a40",
              borderRadius: 10,
              padding: "10px 12px",
              color: "#f0f0ff",
              fontSize: 14,
              outline: "none",
            }}
          >
            <option>All</option>
            {INSTITUTES.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              background: "#12121a",
              border: "1px solid #2a2a40",
              borderRadius: 10,
              padding: "10px 12px",
              color: "#f0f0ff",
              fontSize: 14,
              outline: "none",
            }}
          >
            <option value="score">Score</option>
            <option value="solved">Total Solved</option>
            <option value="hard">Hard Qs</option>
            <option value="name">Name A-Z</option>
          </select>
          <button
            onClick={() => refreshAll(false)}
            disabled={refreshing || students.length === 0}
            style={{
              background: "#1a1a26",
              border: "1px solid #2a2a40",
              borderRadius: 10,
              padding: "10px 16px",
              color: refreshing ? "#8888aa" : "#f0f0ff",
              cursor:
                refreshing || students.length === 0 ? "not-allowed" : "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {refreshing ? (
              <>
                <Spinner /> Refreshing
              </>
            ) : (
              "Refresh All"
            )}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              background: "#7c5cff",
              border: "none",
              borderRadius: 10,
              padding: "10px 20px",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            + Add Student
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: "1rem",
            fontSize: 11,
            color: "#8888aa",
          }}
        >
          {[
            ["#2ecc71", "Easy x1"],
            ["#f39c12", "Medium x3"],
            ["#e74c3c", "Hard x5"],
          ].map(([col, lbl]) => (
            <span
              key={lbl}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: col,
                  display: "inline-block",
                }}
              />
              {lbl}
            </span>
          ))}
          <span style={{ marginLeft: "auto" }}>
            {filtered.length} / {students.length} students
          </span>
        </div>

        {students.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "5rem 2rem",
              border: "1px dashed #2a2a40",
              borderRadius: 16,
              animation: "fadeIn .5s ease",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
              No students yet
            </div>
            <div
              style={{ color: "#8888aa", marginBottom: "1.5rem", fontSize: 14 }}
            >
              Add a student with their LeetCode username to start tracking real
              data.
            </div>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                background: "#7c5cff",
                border: "none",
                borderRadius: 10,
                padding: "12px 28px",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              + Add First Student
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((s, i) => {
            const rank = rankOf(s.id);
            const score = totalScore(s);
            const solved = totalSolved(s);
            const c = INST_COLORS[s.institute] || INST_COLORS.Hitech;
            const isTop3 = rank <= 3 && s.status === "loaded";

            return (
              <div
                key={s.id}
                onClick={() => s.status === "loaded" && setProfileStudent(s)}
                style={{
                  background: "#12121a",
                  border: `1px solid ${isTop3 ? rankColors[rank - 1] + "55" : "#1e1e2e"}`,
                  borderRadius: 14,
                  padding: "0.85rem 1.1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.9rem",
                  animation: `slideIn ${0.08 + i * 0.04}s ease`,
                  position: "relative",
                  overflow: "hidden",
                  cursor: s.status === "loaded" ? "pointer" : "default",
                  transition: "border-color .15s, background .15s",
                }}
                onMouseEnter={(e) => {
                  if (s.status === "loaded")
                    e.currentTarget.style.background = "#16161f";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#12121a";
                }}
              >
                {isTop3 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      background: rankColors[rank - 1],
                      borderRadius: "14px 0 0 14px",
                    }}
                  />
                )}

                <div
                  style={{
                    minWidth: 34,
                    textAlign: "center",
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: isTop3 ? 20 : 13,
                    color: isTop3 ? rankColors[rank - 1] : "#8888aa",
                    fontWeight: 700,
                  }}
                >
                  {s.status === "loaded"
                    ? isTop3
                      ? rankEmoji[rank - 1]
                      : "#" + rank
                    : "-"}
                </div>

                {/* Avatar: real photo if available, else initials */}
                {s.avatar ? (
                  <img
                    src={s.avatar}
                    alt={s.name}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      border: `2px solid ${c.border}`,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: c.light,
                      border: `2px solid ${c.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      color: c.main,
                      flexShrink: 0,
                    }}
                  >
                    {initials(s.name)}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#7c5cff",
                      fontFamily: "'JetBrains Mono',monospace",
                    }}
                  >
                    @{s.username}
                  </span>
                </div>

                <Badge color={c.main}>{s.institute.toUpperCase()}</Badge>

                {s.status === "loading" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: "#8888aa",
                      fontSize: 12,
                    }}
                  >
                    <Spinner /> Fetching...
                  </div>
                )}
                {s.status === "error" && (
                  <div style={{ color: "#e74c3c", fontSize: 12 }}>
                    Fetch failed
                  </div>
                )}
                {s.status === "loaded" && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono',monospace",
                      }}
                    >
                      <span style={{ color: "#2ecc71" }}>{s.easy}E</span>
                      <span style={{ color: "#f39c12" }}>{s.medium}M</span>
                      <span style={{ color: "#e74c3c" }}>{s.hard}H</span>
                    </div>
                    <div style={{ minWidth: 80, textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#8888aa",
                          marginBottom: 4,
                          fontFamily: "'JetBrains Mono',monospace",
                        }}
                      >
                        {solved} solved
                      </div>
                      <div
                        style={{
                          display: "flex",
                          height: 4,
                          borderRadius: 2,
                          overflow: "hidden",
                          gap: 1,
                        }}
                      >
                        {[
                          ["#2ecc71", s.easy],
                          ["#f39c12", s.medium],
                          ["#e74c3c", s.hard],
                        ].map(([col, val]) => (
                          <div
                            key={col}
                            style={{
                              width: `${((val || 0) / Math.max(solved, 1)) * 100}%`,
                              background: col,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 60 }}>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 20,
                          fontWeight: 700,
                          color: c.main,
                        }}
                      >
                        {score}
                      </div>
                      <div style={{ fontSize: 10, color: "#8888aa" }}>pts</div>
                    </div>
                  </>
                )}

                {/* Action buttons — stop click from opening profile */}
                <div
                  style={{ display: "flex", gap: 6, flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => refreshOne(s.id)}
                    title="Refresh"
                    style={{
                      background: "transparent",
                      border: "1px solid #2a2a40",
                      borderRadius: 8,
                      width: 30,
                      height: 30,
                      cursor: "pointer",
                      color: "#7c5cff",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ↺
                  </button>
                  <button
                    onClick={() => removeStudent(s.id)}
                    title="Remove"
                    style={{
                      background: "transparent",
                      border: "1px solid #2a2a40",
                      borderRadius: 8,
                      width: 30,
                      height: 30,
                      cursor: "pointer",
                      color: "#e74c3c",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {students.length > 0 && (
          <div
            style={{
              textAlign: "center",
              marginTop: "3rem",
              color: "#555566",
              fontSize: 11,
            }}
          >
            <LiveDot />
            Data from LeetCode · Easy x1 · Medium x3 · Hard x5 · Saved in
            browser
          </div>
        )}
      </div>
    </>
  );
}
