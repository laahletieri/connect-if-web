export default function AuthCard({ subtitle, onSubmit, children }) {
  return (
    <main className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <img src="/logo.png" alt="Connect IF" className="login-logo" />
        <p className="muted login-subtitle">{subtitle}</p>
        {children}
      </form>
    </main>
  );
}
