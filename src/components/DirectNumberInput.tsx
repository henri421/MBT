import React, { useState, useEffect, useRef } from 'react';

interface DirectNumberInputProps {
  id?: string;
  value: number | undefined | null;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  precision?: number;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Composant de saisie numérique directe et fluide :
 * - Aucune flèche d'incrémentation (aucun spinner gênant)
 * - Accepte indifféremment le point (.) et la virgule (,)
 * - Ne saute pas pendant la saisie décimale (permet d'écrire "0.", "0.35", etc.)
 * - Badge d'unité intégré et lisible
 */
export const DirectNumberInput: React.FC<DirectNumberInputProps> = ({
  id,
  value,
  onChange,
  unit,
  min,
  max,
  placeholder,
  disabled = false,
  className = '',
  inputClassName = '',
  precision,
  title,
  onClick
}) => {
  const isFocusedRef = useRef(false);
  const [text, setText] = useState<string>(() => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return precision !== undefined ? value.toFixed(precision) : String(value);
  });

  // Synchronise la valeur externe uniquement quand l'utilisateur n'est pas en train d'écrire
  useEffect(() => {
    if (!isFocusedRef.current) {
      if (value === undefined || value === null || isNaN(value)) {
        setText('');
      } else {
        setText(precision !== undefined ? value.toFixed(precision) : String(value));
      }
    }
  }, [value, precision]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(',', '.');
    setText(raw);

    // Si la valeur est un nombre fini valide
    if (raw.trim() !== '' && !isNaN(Number(raw))) {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        let clamped = parsed;
        if (min !== undefined && clamped < min) clamped = min;
        if (max !== undefined && clamped > max) clamped = max;
        onChange(clamped);
      }
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const raw = text.replace(',', '.').trim();
    if (raw === '' || isNaN(Number(raw))) {
      // Rétablir la valeur existante
      if (value !== undefined && value !== null && !isNaN(value)) {
        setText(precision !== undefined ? value.toFixed(precision) : String(value));
      } else {
        setText('');
      }
    } else {
      let parsed = parseFloat(raw);
      if (min !== undefined && parsed < min) parsed = min;
      if (max !== undefined && parsed > max) parsed = max;
      onChange(parsed);
      setText(precision !== undefined ? parsed.toFixed(precision) : String(parsed));
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onClick={onClick}
      title={title}
    >
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={text}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white transition-colors ${
          unit ? 'pr-7' : ''
        } ${inputClassName}`}
      />
      {unit && (
        <span className="absolute right-2 text-[10px] font-mono font-bold text-slate-400 pointer-events-none select-none">
          {unit}
        </span>
      )}
    </div>
  );
};
