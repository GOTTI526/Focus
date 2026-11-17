import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PanelAdmin from './PanelAdmin';

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      mockResolvedValue: vi.fn().mockResolvedValue({ data: [], error: null }),
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

vi.mock('./exportToExcel', () => ({
  exportToExcel: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('FocusOS - Pruebas Unitarias Panel Admin', () => {

  it('11. Debe renderizar el header con el nombre del admin', () => {
    render(<PanelAdmin usuario="JAMIL" />);
    expect(screen.getByText(/Admin: JAMIL/i)).toBeInTheDocument();
  });

  it('12. Debe mostrar la pestaña de Asistencia con contadores', async () => {
    render(<PanelAdmin usuario="JAMIL" />);

    const btnAsistencia = screen.getByRole('button', { name: /asistencia/i });

    await act(async () => {
      fireEvent.click(btnAsistencia);
    });

    expect(screen.getByText(/Control de Asistencia de Hoy/i)).toBeInTheDocument();
    expect(screen.getByText(/Presentes:/i)).toBeInTheDocument();
    expect(screen.getByText(/Faltas:/i)).toBeInTheDocument();

    expect(screen.getByText(/No hay personal/i)).toBeInTheDocument();
  });

  it('13. Debe mostrar la pestaña de Empleados con contadores Activos/Inactivos', async () => {
    render(<PanelAdmin usuario="JAMIL" />);

    const btnEmpleados = screen.getByRole('button', { name: /empleados/i });

    await act(async () => {
      fireEvent.click(btnEmpleados);
    });
    const textoActivos = screen.getByText((content) => content.startsWith('Activos:'));
    const textoInactivos = screen.getByText((content) => content.startsWith('Inactivos:'));
    expect(textoActivos).toBeInTheDocument();
    expect(textoInactivos).toBeInTheDocument();
  });

  it('14. Debe renderizar las 4 pestañas principales', () => {
    render(<PanelAdmin usuario="JAMIL" />);
    expect(screen.getByRole('button', { name: /tramites/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /empleados/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /asistencia/i })).toBeInTheDocument();
  });

  it('15. Debe mostrar el botón de Exportar Excel en la pestaña Asistencia', async () => {
    render(<PanelAdmin usuario="JAMIL" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /asistencia/i }));
    });

    expect(screen.getByText(/Exportar Excel/i)).toBeInTheDocument();
  });

});
