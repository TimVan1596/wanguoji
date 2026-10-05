import "swiper/css/bundle";
import "./style.css";

import { Suspense } from "react";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import { BrowserRouter, HashRouter, useRoutes } from "react-router-dom";
import { getGridGodRouterMode } from "./Runtime/DesktopRuntime";
import routes from "~react-pages";
import { PersistGate } from "redux-persist/integration/react";
import { persistStore } from "redux-persist";
import RendererCrashBoundary from "./UI/RendererCrashBoundary";
import { installRendererCrashListeners } from "./Runtime/RendererCrashDiagnostics";
const persistor = persistStore(store);
installRendererCrashListeners();

import { Buffer } from 'buffer'
globalThis.Buffer = Buffer

const AppRouter = getGridGodRouterMode(window.gridGodDesktop?.isDesktop === true) === "hash"
  ? HashRouter
  : BrowserRouter;

const App = () => {
  return <Suspense fallback={<p>Loading...</p>}>{useRoutes(routes)}</Suspense>;
};

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <RendererCrashBoundary>
          <AppRouter><App /></AppRouter>
        </RendererCrashBoundary>
      </PersistGate>
    </Provider>
  </React.StrictMode>
);
