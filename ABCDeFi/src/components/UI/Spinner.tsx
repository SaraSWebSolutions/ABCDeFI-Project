// src/components/UI/Spinner.tsx
import React from "react";
import "./Spinner.css";

/**
 * Simple loading spinner with a sleek modern look.
 */
export const Spinner: React.FC = () => (
  <div className="spinner-container">
    <div className="spinner" />
  </div>
);

export default Spinner;
