jest.mock(
  'vscode',
  () => ({
    commands: {
      executeCommand: jest.fn(() => Promise.resolve()),
      getCommands: jest.fn(() => Promise.resolve([])),
      registerCommand: jest.fn(),
    },
    ConfigurationTarget: {
      Global: 1,
      Workspace: 2,
    },
    Disposable: jest.fn(),
    ExtensionMode: {
      Production: 1,
      Development: 2,
      Test: 3,
    },
    env: {
      openExternal: jest.fn(),
    },
    extensions: {
      getExtension: jest.fn(() => ({ packageJSON: { version: '3.2.0' } })),
    },
    Uri: {
      file: jest.fn((path: string) => ({ fsPath: path })),
      parse: jest.fn((value: string) => ({ value })),
    },
    ViewColumn: {
      One: 1,
    },
    window: {
      createQuickPick: jest.fn(() => ({
        items: [],
        onDidChangeSelection: jest.fn(),
        onDidHide: jest.fn(),
        show: jest.fn(),
      })),
      createWebviewPanel: jest.fn(),
      showErrorMessage: jest.fn(),
      showInformationMessage: jest.fn(),
    },
    workspace: {
      getConfiguration: jest.fn(),
      onDidChangeConfiguration: jest.fn(),
    },
  }),
  { virtual: true }
);

jest.mock('fs', () => ({
  readdirSync: jest.fn(() => ['tools.svg', 'add.svg']),
}));

jest.mock('../src/iconGenerator', () => ({
  applyUserButtonIcon: jest.fn(),
  resetUserButtonIcon: jest.fn(),
}));

jest.mock('../src/manifestUpdater', () => ({
  applyButtonManifest: jest.fn(),
}));

jest.mock('../src/packageUpdater', () => ({
  applyUserButtonName: jest.fn(),
}));

import { commands, window, workspace } from 'vscode';
import { applyUserButtonIcon, resetUserButtonIcon } from '../src/iconGenerator';
import { applyButtonManifest } from '../src/manifestUpdater';
import { applyUserButtonName } from '../src/packageUpdater';
import { activate } from '../src/extension';

describe('extension configurator integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (applyUserButtonIcon as jest.Mock).mockReturnValue(true);
    (resetUserButtonIcon as jest.Mock).mockReturnValue(true);
    (applyButtonManifest as jest.Mock).mockReturnValue(true);
    (applyUserButtonName as jest.Mock).mockReturnValue(true);
  });

  it('does not reapply or reprompt when the configurator save triggers the global buttons listener', async () => {
    let buttonsValue: unknown;
    const config = {
      inspect: jest.fn(() =>
        buttonsValue === undefined
          ? { defaultValue: [] }
          : { defaultValue: [], globalValue: buttonsValue }
      ),
      get: jest.fn((key: string) => (key === 'buttons' ? buttonsValue : undefined)),
      update: jest.fn(async (_key: string, value: unknown) => {
        buttonsValue = value;
      }),
    };
    const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;
    let messageHandler: ((message: unknown) => Promise<void>) | undefined;
    const panel = {
      webview: {
        asWebviewUri: jest.fn((uri: { fsPath: string }) => ({
          toString: () => `vscode-resource:${uri.fsPath}`,
        })),
        cspSource: 'vscode-resource:',
        html: '',
        onDidReceiveMessage: jest.fn((handler) => {
          messageHandler = handler;
        }),
        postMessage: jest.fn(),
      },
    };

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockImplementation((command, handler) => {
      registeredCommands.set(command, handler);
      return { dispose: jest.fn() };
    });
    (window.createWebviewPanel as jest.Mock).mockReturnValue(panel);
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    registeredCommands.get('ShortcutMenuBarPlus.configureButtons')?.();
    await messageHandler?.({
      type: 'save',
      buttons: [
        {
          id: 'userButton01',
          type: 'user',
          enabled: true,
          command: 'workbench.action.showCommands',
          label: 'Commands',
          icon: '',
        },
      ],
    });

    expect(applyButtonManifest).toHaveBeenCalledTimes(2);
    expect(window.showInformationMessage).toHaveBeenCalledTimes(1);

    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.buttons',
    });

    expect(applyButtonManifest).toHaveBeenCalledTimes(2);
    expect(window.showInformationMessage).toHaveBeenCalledTimes(1);
  });

  it('does not mutate package or icon files while running from the extension development host', async () => {
    let buttonsValue: unknown;
    let legacyCommand = 'workbench.action.showCommands';
    const config = {
      inspect: jest.fn(() =>
        buttonsValue === undefined
          ? { defaultValue: [] }
          : { defaultValue: [], globalValue: buttonsValue }
      ),
      get: jest.fn((key: string) => {
        if (key === 'buttons') {
          return buttonsValue;
        }
        if (key === 'userButton01Icon') {
          return 'tools';
        }
        if (key === 'userButton01Name') {
          return 'Dev Name';
        }
        if (key === 'userButton01Command') {
          return legacyCommand;
        }
        return undefined;
      }),
      update: jest.fn(async (_key: string, value: unknown) => {
        buttonsValue = value;
      }),
    };
    const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;
    let messageHandler: ((message: unknown) => Promise<void>) | undefined;
    const panel = {
      webview: {
        asWebviewUri: jest.fn((uri: { fsPath: string }) => ({
          toString: () => `vscode-resource:${uri.fsPath}`,
        })),
        cspSource: 'vscode-resource:',
        html: '',
        onDidReceiveMessage: jest.fn((handler) => {
          messageHandler = handler;
        }),
        postMessage: jest.fn(),
      },
    };

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockImplementation((command, handler) => {
      registeredCommands.set(command, handler);
      return { dispose: jest.fn() };
    });
    (window.createWebviewPanel as jest.Mock).mockReturnValue(panel);
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionMode: 2,
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    expect(applyUserButtonIcon).not.toHaveBeenCalled();
    expect(resetUserButtonIcon).not.toHaveBeenCalled();
    expect(applyUserButtonName).not.toHaveBeenCalled();
    expect(applyButtonManifest).not.toHaveBeenCalled();

    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.userButton01Icon' ||
        section === 'ShortcutMenuBarPlus.userButton01Name' ||
        section === 'ShortcutMenuBarPlus.userButton01Command',
    });

    expect(applyUserButtonIcon).not.toHaveBeenCalled();
    expect(resetUserButtonIcon).not.toHaveBeenCalled();
    expect(applyUserButtonName).not.toHaveBeenCalled();
    expect(applyButtonManifest).not.toHaveBeenCalled();
    expect(window.showInformationMessage).not.toHaveBeenCalled();

    registeredCommands.get('ShortcutMenuBarPlus.userButton01')?.();
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      'workbench.action.showCommands'
    );

    legacyCommand = 'workbench.action.quickOpen';
    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.userButton01Command',
    });
    registeredCommands.get('ShortcutMenuBarPlus.userButton01')?.();
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      'workbench.action.quickOpen'
    );
    expect(applyUserButtonIcon).not.toHaveBeenCalled();
    expect(resetUserButtonIcon).not.toHaveBeenCalled();
    expect(applyUserButtonName).not.toHaveBeenCalled();
    expect(applyButtonManifest).not.toHaveBeenCalled();

    registeredCommands.get('ShortcutMenuBarPlus.configureButtons')?.();
    await messageHandler?.({
      type: 'save',
      buttons: [
        {
          id: 'userButton01',
          type: 'user',
          enabled: true,
          command: 'workbench.action.showCommands',
          label: 'Commands',
          icon: 'tools',
        },
      ],
    });

    expect(config.update).toHaveBeenCalledWith(
      'buttons',
      expect.any(Array),
      expect.any(Number)
    );
    expect(applyUserButtonIcon).not.toHaveBeenCalled();
    expect(resetUserButtonIcon).not.toHaveBeenCalled();
    expect(applyUserButtonName).not.toHaveBeenCalled();
    expect(applyButtonManifest).not.toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'saved',
      needsReload: false,
    });
  });

  it('resets generated icons and prompts reload when a legacy icon setting is cleared', () => {
    const config = {
      inspect: jest.fn(() => ({ defaultValue: [] })),
      get: jest.fn((key: string) =>
        key === 'userButton01Icon' ? '' : undefined
      ),
    };
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    jest.clearAllMocks();
    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.userButton01Icon',
    });

    expect(resetUserButtonIcon).toHaveBeenCalledWith('01', '/fake/ext');
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('reload'),
      'Reload Window'
    );
  });

  it('does not prompt reload when a legacy icon update fails', () => {
    const config = {
      inspect: jest.fn(() => ({ defaultValue: [] })),
      get: jest.fn((key: string) =>
        key === 'userButton01Icon' ? 'missing-icon' : undefined
      ),
    };
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    jest.clearAllMocks();
    (applyUserButtonIcon as jest.Mock).mockReturnValue(false);

    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.userButton01Icon',
    });

    expect(applyUserButtonIcon).toHaveBeenCalledWith(
      '01',
      'missing-icon',
      '/fake/ext'
    );
    expect(window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('does not prompt reload when a legacy name update fails', () => {
    const config = {
      inspect: jest.fn(() => ({ defaultValue: [] })),
      get: jest.fn((key: string) =>
        key === 'userButton01Name' ? 'Broken Name' : undefined
      ),
    };
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    jest.clearAllMocks();
    (applyUserButtonName as jest.Mock).mockReturnValue(false);

    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.userButton01Name',
    });

    expect(applyUserButtonName).toHaveBeenCalledWith(
      '01',
      'Broken Name',
      '/fake/ext'
    );
    expect(window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('ignores legacy icon and name changes when structured buttons are configured', () => {
    const buttonsValue: unknown = [
      {
        id: 'userButton01',
        type: 'user',
        enabled: true,
        command: 'workbench.action.showCommands',
        label: 'Structured',
        icon: 'gear',
      },
    ];
    const config = {
      inspect: jest.fn(() => ({ defaultValue: [], globalValue: buttonsValue })),
      get: jest.fn((key: string) => {
        if (key === 'buttons') {
          return buttonsValue;
        }
        if (key === 'userButton01Icon') {
          return 'tools';
        }
        if (key === 'userButton01Name') {
          return 'Legacy';
        }
        return undefined;
      }),
    };
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    jest.clearAllMocks();

    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.userButton01Icon' ||
        section === 'ShortcutMenuBarPlus.userButton01Name',
    });

    expect(applyUserButtonIcon).not.toHaveBeenCalled();
    expect(resetUserButtonIcon).not.toHaveBeenCalled();
    expect(window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('uses cached structured buttons until the buttons setting changes', () => {
    let buttonsValue: unknown = [
      {
        id: 'userButton01',
        type: 'user',
        enabled: true,
        command: 'workbench.action.showCommands',
        label: '',
        icon: '',
      },
    ];
    const config = {
      inspect: jest.fn(() => ({ defaultValue: [], globalValue: buttonsValue })),
      get: jest.fn((key: string) => (key === 'buttons' ? buttonsValue : undefined)),
    };
    const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockImplementation((command, handler) => {
      registeredCommands.set(command, handler);
      return { dispose: jest.fn() };
    });
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    jest.clearAllMocks();

    registeredCommands.get('ShortcutMenuBarPlus.userButton01')?.();
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      'workbench.action.showCommands'
    );

    buttonsValue = [
      {
        id: 'userButton01',
        type: 'user',
        enabled: true,
        command: 'workbench.action.quickOpen',
        label: '',
        icon: '',
      },
    ];
    registeredCommands.get('ShortcutMenuBarPlus.userButton01')?.();
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      'workbench.action.showCommands'
    );

    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.buttons',
    });
    registeredCommands.get('ShortcutMenuBarPlus.userButton01')?.();
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      'workbench.action.quickOpen'
    );
  });

  it('refreshes cached legacy button commands and reapplies manifest when legacy command settings change', () => {
    let legacyCommand = 'workbench.action.showCommands';
    const config = {
      inspect: jest.fn(() => ({ defaultValue: [] })),
      get: jest.fn((key: string) =>
        key === 'userButton01Command' ? legacyCommand : undefined
      ),
    };
    const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockImplementation((command, handler) => {
      registeredCommands.set(command, handler);
      return { dispose: jest.fn() };
    });
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    jest.clearAllMocks();

    registeredCommands.get('ShortcutMenuBarPlus.userButton01')?.();
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      'workbench.action.showCommands'
    );

    legacyCommand = 'workbench.action.quickOpen';
    registeredCommands.get('ShortcutMenuBarPlus.userButton01')?.();
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      'workbench.action.showCommands'
    );

    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.userButton01Command',
    });
    registeredCommands.get('ShortcutMenuBarPlus.userButton01')?.();
    expect(commands.executeCommand).toHaveBeenLastCalledWith(
      'workbench.action.quickOpen'
    );
    expect(applyButtonManifest).toHaveBeenCalledTimes(1);
    expect(window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('reapplies manifest and prompts reload when a legacy user command becomes enabled', () => {
    let legacyCommand = '';
    const config = {
      inspect: jest.fn(() => ({ defaultValue: [] })),
      get: jest.fn((key: string) =>
        key === 'userButton01Command' ? legacyCommand : undefined
      ),
    };
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    jest.clearAllMocks();

    legacyCommand = 'workbench.action.showCommands';
    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.userButton01Command',
    });

    expect(applyButtonManifest).toHaveBeenCalledTimes(1);
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('reload'),
      'Reload Window'
    );
  });

  it('does not prompt reload when structured manifest apply fails', () => {
    let buttonsValue: unknown = [
      {
        id: 'userButton01',
        type: 'user',
        enabled: false,
        command: '',
        label: '',
        icon: '',
      },
    ];
    const config = {
      inspect: jest.fn(() => ({ defaultValue: [], globalValue: buttonsValue })),
      get: jest.fn((key: string) => (key === 'buttons' ? buttonsValue : undefined)),
    };
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    jest.clearAllMocks();
    (applyButtonManifest as jest.Mock).mockReturnValue(false);
    buttonsValue = [
      {
        id: 'userButton01',
        type: 'user',
        enabled: true,
        command: 'workbench.action.showCommands',
        label: 'Commands',
        icon: '',
      },
    ];

    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.buttons',
    });

    expect(applyButtonManifest).toHaveBeenCalledTimes(1);
    expect(window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('prompts reload after structured manifest succeeds when icon application fails', () => {
    let buttonsValue: unknown = [
      {
        id: 'userButton01',
        type: 'user',
        enabled: false,
        command: '',
        label: '',
        icon: '',
      },
    ];
    const config = {
      inspect: jest.fn(() => ({ defaultValue: [], globalValue: buttonsValue })),
      get: jest.fn((key: string) => (key === 'buttons' ? buttonsValue : undefined)),
    };
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    jest.clearAllMocks();
    (applyUserButtonIcon as jest.Mock).mockReturnValue(false);
    buttonsValue = [
      {
        id: 'userButton01',
        type: 'user',
        enabled: true,
        command: 'workbench.action.showCommands',
        label: 'Commands',
        icon: 'missing-icon',
      },
    ];

    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.buttons',
    });

    expect(applyButtonManifest).toHaveBeenCalledTimes(1);
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('reload'),
      'Reload Window'
    );
  });

  it('reapplies manifest when a legacy built-in visibility setting changes', () => {
    let saveEnabled = false;
    const config = {
      inspect: jest.fn(() => ({ defaultValue: [] })),
      get: jest.fn((key: string) =>
        key === 'save' ? saveEnabled : undefined
      ),
    };
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    jest.clearAllMocks();

    saveEnabled = true;
    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.save',
    });

    expect(applyButtonManifest).toHaveBeenCalledTimes(1);
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('reload'),
      'Reload Window'
    );
  });

  it('does not prompt reload when legacy manifest apply fails', () => {
    let legacyCommand = '';
    const config = {
      inspect: jest.fn(() => ({ defaultValue: [] })),
      get: jest.fn((key: string) =>
        key === 'userButton01Command' ? legacyCommand : undefined
      ),
    };
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    jest.clearAllMocks();
    (applyButtonManifest as jest.Mock).mockReturnValue(false);
    legacyCommand = 'workbench.action.showCommands';

    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.userButton01Command',
    });

    expect(applyButtonManifest).toHaveBeenCalledTimes(1);
    expect(window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('prompts reload after legacy manifest succeeds when name application fails', () => {
    let legacyCommand = '';
    const config = {
      inspect: jest.fn(() => ({ defaultValue: [] })),
      get: jest.fn((key: string) =>
        key === 'userButton01Command'
          ? legacyCommand
          : key === 'userButton01Name'
            ? 'Broken Name'
            : undefined
      ),
    };
    let configChangeHandler:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;

    (workspace.getConfiguration as jest.Mock).mockReturnValue(config);
    (workspace.onDidChangeConfiguration as jest.Mock).mockImplementation((handler) => {
      configChangeHandler = handler;
      return { dispose: jest.fn() };
    });
    (commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });
    (window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

    activate({
      extensionPath: '/fake/ext',
      globalState: {
        get: jest.fn(() => '3.2.0'),
        update: jest.fn(),
      },
      subscriptions: [],
    } as never);

    jest.clearAllMocks();
    (applyUserButtonName as jest.Mock).mockReturnValue(false);
    legacyCommand = 'workbench.action.showCommands';

    configChangeHandler?.({
      affectsConfiguration: (section: string) =>
        section === 'ShortcutMenuBarPlus.userButton01Command',
    });

    expect(applyButtonManifest).toHaveBeenCalledTimes(1);
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('reload'),
      'Reload Window'
    );
  });
});
