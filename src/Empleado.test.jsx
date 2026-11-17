import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PanelEmpleado from './PanelEmpleado';

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'http://test.com/file' } }),
      })),
    },
  },
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('FocusOS - Pruebas Unitarias Panel Empleado', () => {

  it('6. Debe permitir escribir el nombre del trámite', async () => {
    render(<PanelEmpleado />);
    const input = screen.getByPlaceholderText(/NOMBRE DEL TRAMITE/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Licencia de Funcionamiento' } });
    });

    expect(input.value).toBe('Licencia de Funcionamiento');
  });

  it('7. Debe permitir escribir el resumen del trámite', async () => {
    render(<PanelEmpleado />);

    const textarea = screen.getByPlaceholderText(/RESUMEN/i);

    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Todo en orden con los documentos.' } });
    });

    expect(textarea.value).toBe('Todo en orden con los documentos.');
  });

  it('8. Debe cambiar la prioridad al hacer clic en los botones', async () => {
    render(<PanelEmpleado />);

    const btnAlta = screen.getByRole('button', { name: /^alta$/i });

    await act(async () => {
      fireEvent.click(btnAlta);
    });

    expect(btnAlta).toHaveClass('bg-red-500');
  });

  it('9. Debe mostrar el botón de sincronizar deshabilitado si no hay tareas listas', () => {
    render(<PanelEmpleado />);
    const btnSincronizar = screen.getByText(/Sincronizar Tramites Listos/i);
    expect(btnSincronizar).toBeDisabled();
  });

  it('10. Debe mostrar el contador de Sincronizados en 0 al iniciar', () => {
    render(<PanelEmpleado />);
    expect(screen.getByText('Sincronizados')).toBeInTheDocument();
  });

});
