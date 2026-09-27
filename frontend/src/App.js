import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import React, { useState } from 'react';
import Login from './Login';
import QuestionForm from './QuestionForm';
import SelectComponents from './SelectComponents';
import AdvancedConfiguration from './AdvancedConfiguration';

const App = () => {
  const [recommendedComponents, setRecommendedComponents] = useState([]);
  const [usage, setUsage] = useState('');
  const [budget, setBudget] = useState('');

  const handleLogin = (token) => {
    localStorage.setItem('token', token); // Guardamos el token en localStorage
  };

  const handleNext = ({ components, usageSelected, budgetSelected }) => {
    setRecommendedComponents(components || []);
    if (usageSelected !== undefined) setUsage(usageSelected);
    if (budgetSelected !== undefined) setBudget(budgetSelected);
  };

return (
    <Router>
      <Routes>
        <Route path="/" element={<Login onLogin={handleLogin} />} />
        <Route
          path="/questions"
          element={
            <QuestionForm
              onNext={handleNext}
              usageSelected={usage}
              budgetSelected={budget}
              // (opcional) si prefieres levantar el estado
              setUsageSelected={setUsage}
              setBudgetSelected={setBudget}
            />
          }
        />
        <Route
          path="/select-components"
          element={<SelectComponents recommendedComponents={recommendedComponents} />}
        />
        <Route path="/advanced-configuration" element={<AdvancedConfiguration />} />
      </Routes>
    </Router>
  );
};

export default App;