import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Falso error' } })
    }))
  }
}));

vi.mock('@emailjs/browser', () => ({
  default: {
    init: vi.fn(),
    send: vi.fn()
  }
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('FocusOS - Pruebas Unitarias de Login y Recuperación', () => {

  it('1. Debe mostrar "Ingresa tus credenciales." si los campos están vacíos', async () => {
    render(<App />);
    const boton = screen.getByText(/Iniciar Operacion/i);
    fireEvent.click(boton);

    const mensajeError = await screen.findByText(/Ingresa tus credenciales\./i);
    expect(mensajeError).toBeInTheDocument();
  });

  it('2. Debe permitir escribir en los campos de Correo y Contraseña', () => {
    render(<App />);
    const inputCorreo = screen.getByPlaceholderText(/CORREO EMPRESA/i);
    const inputPass = screen.getByPlaceholderText(/CONTRASENA/i);
    fireEvent.change(inputCorreo, { target: { value: 'admin@focusos.com' } });
    fireEvent.change(inputPass, { target: { value: '123456' } });
    expect(inputCorreo.value).toBe('admin@focusos.com');
    expect(inputPass.value).toBe('123456');
  });

  it('3. Debe cambiar a la vista de recuperación al hacer clic en "Olvidé mi contraseña"', () => {
    render(<App />);
    const botonOlvidar = screen.getByText(/olvide mi contrase/i);
    fireEvent.click(botonOlvidar);
    const textoRecuperacion = screen.getByText(/Ingresa tu correo de empresa/i);
    expect(textoRecuperacion).toBeInTheDocument();
  });

  it('4. Debe mostrar mensaje de error con datos inválidos', async () => {
    render(<App />);
    const inputCorreo = screen.getByPlaceholderText(/CORREO EMPRESA/i);
    const inputPass = screen.getByPlaceholderText(/CONTRASENA/i);
    const boton = screen.getByText(/Iniciar Operacion/i);

    fireEvent.change(inputCorreo, { target: { value: 'hacker@falso.com' } });
    fireEvent.change(inputPass, { target: { value: 'clavemala' } });
    fireEvent.click(boton);
    const mensajeError = await screen.findByText(/correo o contrase/i);
    expect(mensajeError).toBeInTheDocument();
  });

  it('5. Debe pedir correo si se intenta recuperar contraseña con el campo vacío', async () => {
    render(<App />);
    fireEvent.click(screen.getByText(/olvide mi contrase/i));

    const botonEnviar = screen.getByText(/Enviar Codigo/i);
    fireEvent.click(botonEnviar);

    const mensajeError = await screen.findByText(/Ingresa tu correo de empresa\./i);
    expect(mensajeError).toBeInTheDocument();
  });

});
