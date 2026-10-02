import * as fs from 'fs';
import * as path from 'path';
import { applyUserButtonIcon, resetUserButtonIcon } from '../src/iconGenerator';

jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

const CODICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">' +
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1z"/>' +
  '</svg>';

describe('applyUserButtonIcon', () => {
  const extensionPath = '/fake/ext';

  beforeEach(() => {
    jest.clearAllMocks();
    (mockFs.readFileSync as jest.Mock).mockReturnValue(CODICON_SVG);
    (mockFs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  it('reads the codicon SVG from the correct path', () => {
    applyUserButtonIcon('01', 'star', extensionPath);
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      path.join(extensionPath, 'node_modules', '@vscode', 'codicons', 'src', 'icons', 'star.svg'),
      'utf8'
    );
  });

  it('writes dark SVG with fill #C5C5C5 to images/userButtonXX.svg', () => {
    applyUserButtonIcon('01', 'star', extensionPath);
    const call = (mockFs.writeFileSync as jest.Mock).mock.calls.find(
      (c: unknown[]) => (c[0] as string).endsWith('userButton01.svg')
    );
    expect(call).toBeDefined();
    expect(call![1]).toContain('fill="#C5C5C5"');
    expect(call![2]).toBe('utf8');
  });

  it('writes light SVG with fill #424242 to images/userButtonXX_light.svg', () => {
    applyUserButtonIcon('01', 'star', extensionPath);
    const call = (mockFs.writeFileSync as jest.Mock).mock.calls.find(
      (c: unknown[]) => (c[0] as string).endsWith('userButton01_light.svg')
    );
    expect(call).toBeDefined();
    expect(call![1]).toContain('fill="#424242"');
    expect(call![2]).toBe('utf8');
  });

  it('uses correct file paths for button index 10', () => {
    applyUserButtonIcon('10', 'gear', extensionPath);
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      path.join(extensionPath, 'images', 'userButton10.svg'),
      expect.any(String),
      'utf8'
    );
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      path.join(extensionPath, 'images', 'userButton10_light.svg'),
      expect.any(String),
      'utf8'
    );
  });

  it('does not write files when codicon is not found, and logs a warning', () => {
    (mockFs.readFileSync as jest.Mock).mockImplementation(() => {
      const err = new Error('ENOENT: no such file') as Error & {
        code: string;
      };
      err.code = 'ENOENT';
      throw err;
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    applyUserButtonIcon('01', 'nonexistent-icon', extensionPath);

    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('nonexistent-icon')
    );
    warnSpy.mockRestore();
  });

  it('rejects traversal-like icon names before reading codicon files', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = applyUserButtonIcon('01', '../../../../tmp/secret', extensionPath);

    expect(result).toBe(false);
    expect(mockFs.readFileSync).not.toHaveBeenCalled();
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Refusing invalid codicon name')
    );
    warnSpy.mockRestore();
  });

  it('rejects icon names containing dot segments before reading codicon files', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = applyUserButtonIcon('01', '..', extensionPath);

    expect(result).toBe(false);
    expect(mockFs.readFileSync).not.toHaveBeenCalled();
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not write files when codicon read fails for another reason, and logs an error', () => {
    (mockFs.readFileSync as jest.Mock).mockImplementation(() => {
      const err = new Error('EACCES: permission denied') as Error & {
        code: string;
      };
      err.code = 'EACCES';
      throw err;
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    applyUserButtonIcon('01', 'star', extensionPath);

    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toEqual(
      expect.stringContaining('Failed to read codicon')
    );
    errorSpy.mockRestore();
  });

  it('strips existing fill attributes from the codicon SVG before adding new fill', () => {
    const svgWithFill =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">' +
      '<path fill="#ff0000" d="M0 0h16v16H0z"/>' +
      '</svg>';
    (mockFs.readFileSync as jest.Mock).mockReturnValue(svgWithFill);

    applyUserButtonIcon('01', 'star', extensionPath);

    const darkCall = (mockFs.writeFileSync as jest.Mock).mock.calls.find(
      (c: unknown[]) => (c[0] as string).endsWith('userButton01.svg')
    );
    expect(darkCall![1]).not.toContain('fill="#ff0000"');
    expect(darkCall![1]).toContain('fill="#C5C5C5"');
  });

  it('keeps invalid codicon SVG content unchanged and logs a warning', () => {
    const invalidSvg = '<path d="M0 0h16v16H0z"/>';
    (mockFs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('@vscode')) {
        return invalidSvg;
      }
      const err = new Error('ENOENT: no such file') as Error & {
        code: string;
      };
      err.code = 'ENOENT';
      throw err;
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    applyUserButtonIcon('01', 'star', extensionPath);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      path.join(extensionPath, 'images', 'userButton01.svg'),
      invalidSvg,
      'utf8'
    );
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      path.join(extensionPath, 'images', 'userButton01_light.svg'),
      invalidSvg,
      'utf8'
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid codiconSvg input')
    );
    warnSpy.mockRestore();
  });

  it('resets to the default numbered icon when a custom icon is cleared', () => {
    resetUserButtonIcon('01', extensionPath);

    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      path.join(extensionPath, 'images', 'userButton01.svg'),
      'utf8'
    );
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      path.join(extensionPath, 'images', 'userButton01.svg'),
      expect.stringContaining('fill="#c5c5c5"'),
      'utf8'
    );
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      path.join(extensionPath, 'images', 'userButton01_light.svg'),
      expect.stringContaining('fill="#424242"'),
      'utf8'
    );
  });

  it('does not rewrite a user icon file that is already current', () => {
    resetUserButtonIcon('01', extensionPath);
    const generatedFiles = new Map<string, string>(
      mockFs.writeFileSync.mock.calls.map(([filePath, content]) => [
        String(filePath), String(content),
      ])
    );
    mockFs.writeFileSync.mockClear();
    mockFs.readFileSync.mockImplementation((filePath) => generatedFiles.get(String(filePath)) ?? '');

    expect(resetUserButtonIcon('01', extensionPath)).toBe(true);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });
});
