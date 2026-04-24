import React, { useEffect, useState } from 'react';
import { LogOut, UserCheck } from 'lucide-react';
import { STORAGE_KEYS } from '../../utils/api';
import './ImpersonationBanner.css';

const BACKUP_KEY = 'rabs_impersonator_backup';

const ImpersonationBanner = () => {
  const [backup, setBackup] = useState(null);
  const [currentName, setCurrentName] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.user && parsed?.tokens) {
          setBackup(parsed);
          const curRaw = localStorage.getItem(STORAGE_KEYS.USER_DATA);
          if (curRaw) {
            const cur = JSON.parse(curRaw);
            setCurrentName(cur?.full_name || cur?.username || '');
          }
        }
      }
    } catch { }
  }, []);

  const handleReturn = () => {
    if (!backup) return;
    try {
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(backup.user));
      localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(backup.tokens));
      localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(backup.permissions || []));
      localStorage.removeItem(BACKUP_KEY);
    } catch { }
    window.location.href = '/';
  };

  if (!backup) return null;

  const originalName = backup.user?.full_name || backup.user?.username || 'your account';

  return (
    <div className="imp-banner">
      <div className="imp-banner__inner">
        <UserCheck size={15} />
        <span className="imp-banner__text">
          Viewing as <strong>{currentName || 'user'}</strong> · signed in from <strong>{originalName}</strong>
        </span>
        <button className="imp-banner__btn" onClick={handleReturn}>
          <LogOut size={13} />
          <span>Return to my account</span>
        </button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
