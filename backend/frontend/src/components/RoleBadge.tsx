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
    installer: 'cyan',
    engineer: 'orange',
    chief_engineer: 'gold',
    supervisor: 'purple',
    tech_director: 'magenta',
    executive_director: 'volcano',
    general_director: 'red',
  };

  const labels: Record<string, string> = {
    admin: 'Администратор',
    dispatcher: 'Диспетчер',
    master: 'Мастер',
    installer: 'Монтажник',
    engineer: 'Инженер',
    chief_engineer: 'Главный инженер',
    supervisor: 'Начальник сервисной службы',
    tech_director: 'Технический директор',
    executive_director: 'Исполнительный директор',
    general_director: 'Генеральный директор',
  };

  return (
    <Tag color={colors[role] || 'default'}>
      {labels[role] || role}
    </Tag>
  );
};

export default RoleBadge;
