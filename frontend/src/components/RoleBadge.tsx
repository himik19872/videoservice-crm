import React from 'react';
import { Tag } from 'antd';

interface RoleBadgeProps {
  role: string;
}

const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const colors: Record<string, string> = {
    admin: 'red',
    dispatcher: 'blue',
    master: 'green',
  };

  const labels: Record<string, string> = {
    admin: 'Администратор',
    dispatcher: 'Диспетчер',
    master: 'Мастер',
  };

  return (
    <Tag color={colors[role] || 'default'}>
      {labels[role] || role}
    </Tag>
  );
};

export default RoleBadge;
