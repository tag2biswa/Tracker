import React, { useEffect, useState } from 'react';

function TrackedIdentifiersManager() {
  const [identifiers, setIdentifiers] = useState([]);
  const [newIdentifier, setNewIdentifier] = useState('');
  const [error, setError] = useState('');

  const fetchIdentifiers = () => {
    fetch('http://localhost:3000/tracked-identifiers/')
      .then(res => res.json())
      .then(data => setIdentifiers(data))
      .catch(err => setError('Failed to load identifiers'));
  };

  useEffect(() => {
    fetchIdentifiers();
  }, []);

  const handleAdd = () => {
    if (!newIdentifier.trim()) return;
    fetch('http://localhost:3000/tracked-identifiers/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: newIdentifier.trim() })
    })
      .then(res => {
        if (!res.ok) throw new Error('Already exists or invalid');
        return res.json();
      })
      .then(() => {
        setNewIdentifier('');
        fetchIdentifiers();
      })
      .catch(err => setError('Failed to add identifier'));
  };

  const handleRemove = (identifier) => {
    fetch('http://localhost:3000/tracked-identifiers/', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    })
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(() => fetchIdentifiers())
      .catch(err => setError('Failed to remove identifier'));
  };

  return (
    <div>
      <h2>Manage Tracked Identifiers</h2>
      <input
        type="text"
        value={newIdentifier}
        onChange={(e) => setNewIdentifier(e.target.value)}
        placeholder="Enter app name or window title"
      />
      <button onClick={handleAdd}>Add</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {identifiers.map((id, idx) => (
          <li key={idx}>
            {id}
            <button onClick={() => handleRemove(id)} style={{ marginLeft: '10px' }}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TrackedIdentifiersManager;