import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Library from './pages/Library';
import Reader from './pages/Reader';
import Settings from './pages/Settings';
import PageTransition from './motion/PageTransition';

export default function App() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageTransition>
              <Library />
            </PageTransition>
          }
        />
        <Route
          path="/read/:bookId"
          element={
            <PageTransition>
              <Reader />
            </PageTransition>
          }
        />
        <Route
          path="/settings"
          element={
            <PageTransition>
              <Settings />
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}
