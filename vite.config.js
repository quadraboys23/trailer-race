// Port 5180, not Vite's default 5173: another project on this machine binds
// [::1]:5173, and macOS resolves `localhost` to ::1 first, so both servers
// "start fine" and localhost silently serves the wrong app. strictPort makes a
// clash fail loudly instead of drifting to another port.
export default {
  server: {
    host: true,
    port: 5180,
    strictPort: true,
  },
};
