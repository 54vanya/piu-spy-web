import React from 'react';

const Grade = ({ grade }) => {
  if (!grade || grade === '?') {
    return null;
  }
  return <img src={`${process.env.PUBLIC_URL}/grades/${grade}.png`} alt={grade} />;
};

export default React.memo(Grade);
