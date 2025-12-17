import React, { useRef, useEffect } from 'react';

export default function CodeInput({ length = 6, value = '', onChange }) {
  const inputs = useRef([]);

  useEffect(() => {
    // focus first empty
    const firstEmpty = value.split('').findIndex((c) => !c);
    const idx = firstEmpty === -1 ? Math.min(value.length, length - 1) : firstEmpty;
    inputs.current[idx]?.focus();
  }, []);

  const handleChange = (e, i) => {
    const char = e.target.value.slice(-1);
    const arr = value.split('').slice(0, length);
    arr[i] = char || '';
    const newVal = arr.join('');
    onChange(newVal);
    if (char && inputs.current[i + 1]) inputs.current[i + 1].focus();
  };

  const handleKeyDown = (e, i) => {
    if (e.key === 'Backspace' && !value[i] && inputs.current[i - 1]) {
      const arr = value.split('').slice(0, length);
      arr[i - 1] = '';
      onChange(arr.join(''));
      inputs.current[i - 1].focus();
    }
    if (e.key === 'ArrowLeft' && inputs.current[i - 1]) inputs.current[i - 1].focus();
    if (e.key === 'ArrowRight' && inputs.current[i + 1]) inputs.current[i + 1].focus();
  };

  const chars = value.padEnd(length, ' ').slice(0, length).split('');

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          value={chars[i] === ' ' ? '' : chars[i]}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          maxLength={1}
          className="w-12 h-12 text-center border rounded-md text-xl font-semibold"
          inputMode="text"
        />
      ))}
    </div>
  );
}
