import React, { useContext } from 'react';
import { AuthContext } from './AuthContext';
import { Button, Box, Typography } from '@mui/material';

function AdminPanel() {
  const { token } = useContext(AuthContext);

  const handleScrape = async () => {
    const res = await fetch('http://localhost:5000/api/admin/fetch-components', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ category: 'all', search: 'AMD' })
    });

    const data = await res.json();
    alert(data.status || data.error);
  };

  if (!token) return null;

  return (
    <Box mt={4}>
      <Typography variant="h6" gutterBottom>Panel de Administración</Typography>
      <Button variant="outlined" color="secondary" onClick={handleScrape}>
        Poblar componentes desde PCPartPicker
      </Button>
    </Box>
  );
}

export default AdminPanel;
