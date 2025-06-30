import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StagewiseToolbar } from '@stagewise/toolbar-react';
import { ReactPlugin } from '@stagewise-plugins/react';
import Layout from './Layout.jsx';
import Chat from './Pages/Chat';
import Network from './Pages/Network';
import People from './Pages/People';
import Profile from './Pages/Profile';
import { ThemeProvider } from './Components/ui/ThemeProvider';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="graphmind-theme">
      <StagewiseToolbar
        config={{
          plugins: [ReactPlugin],
        }}
      />
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/network" element={<Network />} />
            <Route path="/people" element={<People />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App; 