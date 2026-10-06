import React from "react";
import { useNavigate } from "react-router-dom";
import OralReadingScreen from "@/components/OralReadingScreen";

export const OralReadingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleComplete = () => {
    navigate("/student/dashboard");
  };

  const handleBack = () => {
    navigate("/student/dashboard");
  };

  return (
    <OralReadingScreen onComplete={handleComplete} onBack={handleBack} />
  );
};

export default OralReadingPage;
