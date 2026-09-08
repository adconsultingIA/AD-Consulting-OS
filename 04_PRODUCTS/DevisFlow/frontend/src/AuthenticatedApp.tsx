import App from "./App";

import {
  useAuth,
} from "./context/AuthContext";

import LoginPage from "./pages/LoginPage";


export default function AuthenticatedApp() {
  const {
    session,
    sessionLoading,
  } = useAuth();


  if (sessionLoading) {
    return (
      <div className="df-auth-loading">
        Connexion à AD Consulting IA…
      </div>
    );
  }


  if (!session) {
    return <LoginPage />;
  }


  return <App />;
}
