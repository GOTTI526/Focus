import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import { supabase } from './supabaseClient';
vi.mock('./supabaseClient', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      from: vi.fn(() => mockChain),
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
  };
});

vi.mock('@emailjs/browser', () => ({
  default: { init: vi.fn(), send: vi.fn() }
}));

vi.mock('./exportToExcel', () => ({
  exportToExcel: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Pruebas de Integración - FocusOS', () => {

  it('Flujo Completo: Login -> Panel Empleado -> Agregar Tarea', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 99, Nombre: 'Jamil Test', Rol: 'empleado', estado: 'activo', Email: 'jamil@focusos.com' },
      error: null,
    });

    render(<App />);

    const inputEmail = screen.getByPlaceholderText(/CORREO EMPRESA/i);
    const inputPass = screen.getByPlaceholderText(/CONTRASENA/i);
    const btnLogin = screen.getByText(/Iniciar Operacion/i);

    fireEvent.change(inputEmail, { target: { value: 'jamil@focusos.com' } });
    fireEvent.change(inputPass, { target: { value: '123456' } });
    fireEvent.click(btnLogin);
    await waitFor(() => {
      expect(screen.getByText(/Operador: JAMIL TEST/i)).toBeInTheDocument();
    }, { timeout: 3000 });
    const inputTramite = screen.getByPlaceholderText(/NOMBRE DEL TRAMITE/i);
    const inputDesc = screen.getByPlaceholderText(/RESUMEN/i);
    const btnGuardar = screen.getByText(/Guardar en Cola/i);

    fireEvent.change(inputTramite, { target: { value: 'TRAMITE TESIS' } });
    fireEvent.change(inputDesc, { target: { value: 'Prueba de integracion' } });
    fireEvent.click(btnGuardar);

    expect(screen.getByText(/TRAMITE TESIS/i)).toBeInTheDocument();
  });

  it('Acceso Admin: Debe mostrar el panel de admin tras login exitoso', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 41, Nombre: 'Admin Focus', Rol: 'admin', estado: 'activo', Email: 'jamil@focusos.com' },
      error: null,
    });

    render(<App />);

    const inputEmail = screen.getByPlaceholderText(/CORREO EMPRESA/i);
    const inputPass = screen.getByPlaceholderText(/CONTRASENA/i);
    const btnLogin = screen.getByText(/Iniciar Operacion/i);

    fireEvent.change(inputEmail, { target: { value: 'jamil@focusos.com' } });
    fireEvent.change(inputPass, { target: { value: 'ATOMICO12345' } });
    fireEvent.click(btnLogin);

    await waitFor(() => {
      expect(screen.getByText(/Admin: ADMIN FOCUS/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByRole('button', { name: /tramites/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('Login fallido: debe mostrar error si Supabase devuelve error', async () => {
    supabase.from().single.mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    });

    render(<App />);

    const inputEmail = screen.getByPlaceholderText(/CORREO EMPRESA/i);
    const inputPass = screen.getByPlaceholderText(/CONTRASENA/i);
    const btnLogin = screen.getByText(/Iniciar Operacion/i);

    fireEvent.change(inputEmail, { target: { value: 'wrong@test.com' } });
    fireEvent.change(inputPass, { target: { value: 'wrongpass' } });
    fireEvent.click(btnLogin);

    await waitFor(() => {
      expect(screen.getByText(/correo o contrase/i)).toBeInTheDocument();
    });
  });

  it('Login cuenta inactiva: debe mostrar mensaje de cuenta desactivada', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 1, Nombre: 'Test', Rol: 'empleado', estado: 'inactivo', Email: 'test@focusos.com' },
      error: null,
    });

    render(<App />);

    const inputEmail = screen.getByPlaceholderText(/CORREO EMPRESA/i);
    const inputPass = screen.getByPlaceholderText(/CONTRASENA/i);

    fireEvent.change(inputEmail, { target: { value: 'test@focusos.com' } });
    fireEvent.change(inputPass, { target: { value: '123456' } });
    fireEvent.click(screen.getByText(/Iniciar Operacion/i));

    await waitFor(() => {
      expect(screen.getByText(/Tu cuenta esta desactivada/i)).toBeInTheDocument();
    });
  });

});
