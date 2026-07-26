import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Restore the deep link that GitHub Pages' 404.html bounced through,
// since Pages has no server-side routing for client-side routes.
const redirect = sessionStorage.redirect;
delete sessionStorage.redirect;
if (redirect && redirect !== location.href) {
  history.replaceState(null, '', redirect.replace(location.origin, ''));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
