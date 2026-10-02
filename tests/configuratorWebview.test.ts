jest.mock(
  'vscode',
  () => ({
    commands: {
      executeCommand: jest.fn(),
      registerCommand: jest.fn(),
    },
    ConfigurationTarget: {
      Global: 1,
      Workspace: 2,
    },
    Uri: {
      file: jest.fn((path: string) => ({ fsPath: path })),
    },
    ViewColumn: {
      One: 1,
    },
    window: {
      createWebviewPanel: jest.fn(),
      showErrorMessage: jest.fn(),
      showInformationMessage: jest.fn(),
    },
    workspace: {
      getConfiguration: jest.fn(),
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

import { commands, window, workspace } from 'vscode';
import { readdirSync } from 'fs';
import { Script } from 'vm';
import { applyUserButtonIcon, resetUserButtonIcon } from '../src/iconGenerator';
import { applyButtonManifest } from '../src/manifestUpdater';
import {
  consumeConfiguratorButtonSave,
  getCodiconNames,
  registerConfiguratorCommand,
  renderConfiguratorHtml,
} from '../src/configuratorWebview';

describe('renderConfiguratorHtml', () => {
  it('renders button rows, reload copy, and codicon picker controls', () => {
    const html = renderConfiguratorHtml({
      nonce: 'abc123',
      cspSource: 'vscode-resource:',
      codiconStyleUri: 'vscode-resource:/codicon.css',
      buttons: [
        { id: 'save', type: 'builtin', enabled: true },
        {
          id: 'userButton01',
          type: 'user',
          enabled: true,
          command: 'workbench.action.showCommands',
          label: 'Commands',
          icon: 'commands',
        },
      ],
      codicons: ['add', 'commands'],
    });

    expect(html).toContain(
      `Content-Security-Policy" content="default-src 'none'; style-src vscode-resource: 'unsafe-inline'; font-src vscode-resource:; script-src 'nonce-abc123';`
    );
    expect(html).toContain('<link rel="stylesheet" href="vscode-resource:/codicon.css">');
    expect(html).toContain('data-button-id="save"');
    expect(html).toContain('data-button-id="userButton01"');
    expect(html).toContain('data-icon="commands"');
  });

  it('escapes user-controlled command, label, and icon values', () => {
    const html = renderConfiguratorHtml({
      nonce: 'abc"123',
      cspSource: 'vscode-resource:"',
      codiconStyleUri: 'vscode-resource:/codicon.css"',
      buttons: [
        { id: 'save"<bad>', type: 'builtin', enabled: true },
        {
          id: 'userButton01',
          type: 'user',
          enabled: true,
          command: 'command"<script>',
          label: '<Label>',
          icon: "x' onclick='bad",
        },
      ],
      codicons: ['x"<bad>'],
    });

    expect(html).toContain('nonce="abc&quot;123"');
    expect(html).toContain("script-src 'nonce-abc&quot;123'");
    expect(html).toContain("style-src vscode-resource:&quot; 'unsafe-inline'");
    expect(html).toContain('href="vscode-resource:/codicon.css&quot;"');
    expect(html).toContain('data-button-id="save&quot;&lt;bad&gt;"');
    expect(html).toContain('save&quot;&lt;bad&gt;');
    expect(html).toContain('value="command&quot;&lt;script&gt;"');
    expect(html).toContain('&lt;Label&gt;');
    expect(html).toContain('value="x&#39; onclick=&#39;bad"');
    expect(html).toContain('data-icon="x&quot;&lt;bad&gt;"');
  });

  it('enables reload and banner only after a reload-relevant saved ack', () => {
    const harness = runClientScript(
      renderConfiguratorHtml({
        nonce: 'abc123',
        cspSource: 'vscode-resource:',
        codiconStyleUri: 'vscode-resource:/codicon.css',
        buttons: [],
        codicons: [],
      })
    );

    harness.elements.reloadTop.click();
    expect(harness.messages).toEqual([]);

    harness.sendWindowMessage({ type: 'saved', needsReload: false });
    expect(harness.elements.reloadTop.disabled).toBe(true);
    expect(harness.elements.reloadBottom.disabled).toBe(true);
    expect(harness.elements.reloadBanner.visible).toBe(false);
    harness.elements.reloadBottom.click();
    expect(harness.messages).toEqual([]);

    harness.sendWindowMessage({ type: 'saved', needsReload: true });
    expect(harness.elements.reloadTop.disabled).toBe(false);
    expect(harness.elements.reloadBottom.disabled).toBe(false);
    expect(harness.elements.reloadBanner.visible).toBe(true);
    harness.elements.reloadBottom.click();
    expect(harness.messages).toEqual([{ type: 'reload' }]);
  });

  it('serializes built-in and user rows when saving', () => {
    const harness = runClientScript(
      renderConfiguratorHtml({
        nonce: 'abc123',
        cspSource: 'vscode-resource:',
        codiconStyleUri: 'vscode-resource:/codicon.css',
        buttons: [],
        codicons: [],
      })
    );

    harness.elements.saveBottom.click();

    expect(harness.messages).toEqual([
      {
        type: 'save',
        buttons: [
          {
            id: 'save',
            type: 'builtin',
            enabled: true,
          },
          {
            id: 'userButton01',
            type: 'user',
            enabled: false,
            command: 'workbench.action.showCommands',
            label: 'Commands',
            icon: 'commands',
          },
        ],
      },
    ]);
  });

  it('shows the full icon list from the picker toggle after filtering', () => {
    const harness = runClientScript(
      renderConfiguratorHtml({
        nonce: 'abc123',
        cspSource: 'vscode-resource:',
        codiconStyleUri: 'vscode-resource:/codicon.css',
        buttons: [],
        codicons: [],
      })
    );
    const picker = harness.iconPickers[0];
    const input = picker.querySelector('.icon-input');
    const toggle = picker.querySelector('.icon-toggle');
    const options = picker.querySelectorAll('.icon-option');

    input.value = 'comm';
    input.dispatch('input');

    expect(options[0].hidden).toBe(true);
    expect(options[1].hidden).toBe(false);

    toggle.click();

    expect(options[0].hidden).toBe(false);
    expect(options[1].hidden).toBe(false);
    expect(picker.querySelector('.icon-menu').classList.contains('open')).toBe(true);
  });

  it('filters icon picker options while typing and updates the selected preview', () => {
    const harness = runClientScript(
      renderConfiguratorHtml({
        nonce: 'abc123',
        cspSource: 'vscode-resource:',
        codiconStyleUri: 'vscode-resource:/codicon.css',
        buttons: [],
        codicons: [],
      })
    );
    const picker = harness.iconPickers[0];
    const input = picker.querySelector('.icon-input');
    const preview = picker.querySelector('.icon-preview');
    const options = picker.querySelectorAll('.icon-option');

    input.value = 'add';
    input.dispatch('input');

    expect(options[0].hidden).toBe(false);
    expect(options[1].hidden).toBe(true);
    expect(preview.className?.split(/\s+/).sort()).toEqual(['codicon', 'codicon-add', 'icon-preview']);

    input.value = 'add bad';
    input.dispatch('input');

    expect(preview.className?.split(/\s+/).sort()).toEqual(['codicon', 'icon-preview']);
  });

  it('selects icon picker options into the icon input', () => {
    const harness = runClientScript(
      renderConfiguratorHtml({
        nonce: 'abc123',
        cspSource: 'vscode-resource:',
        codiconStyleUri: 'vscode-resource:/codicon.css',
        buttons: [],
        codicons: [],
      })
    );
    const picker = harness.iconPickers[0];
    const input = picker.querySelector('.icon-input');
    const preview = picker.querySelector('.icon-preview');
    const options = picker.querySelectorAll('.icon-option');

    options[0].click();

    expect(input.value).toBe('add');
    expect(preview.className?.split(/\s+/).sort()).toEqual(['codicon', 'codicon-add', 'icon-preview']);
    expect(picker.querySelector('.icon-menu').classList.contains('open')).toBe(false);
  });

  it('moves rows before targets and to the end drop zone', () => {
    const harness = runClientScript(
      renderConfiguratorHtml({
        nonce: 'abc123',
        cspSource: 'vscode-resource:',
        codiconStyleUri: 'vscode-resource:/codicon.css',
        buttons: [],
        codicons: [],
      })
    );

    const [saveRow, userRow] = harness.rows;
    userRow.dispatch('dragstart');
    saveRow.dispatch('drop');
    harness.elements.saveTop.click();

    const savedOrder = (message: unknown): string[] =>
      (message as { buttons: { id: string }[] }).buttons.map((button) => button.id);
    expect(savedOrder(harness.messages[0])).toEqual(['userButton01', 'save']);

    userRow.dispatch('dragstart');
    harness.elements.endDropZone.dispatch('drop');
    harness.elements.saveBottom.click();

    expect(savedOrder(harness.messages[1])).toEqual(['save', 'userButton01']);
  });
});

describe('getCodiconNames', () => {
  it('returns sorted svg basenames without extensions', () => {
    const names = getCodiconNames('/fake/ext', [
      'tools.svg',
      'add.svg',
      'README.md',
    ]);

    expect(names).toEqual(['add', 'tools']);
  });

  it('returns an empty list when bundled codicons cannot be enumerated', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (readdirSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('missing codicons');
    });

    const names = getCodiconNames('/fake/ext');

    expect(names).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      '[ShortcutMenuBarPlus] Failed to enumerate bundled codicons.',
      expect.any(Error)
    );

    errorSpy.mockRestore();
  });
});

describe('registerConfiguratorCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (workspace as unknown as { workspaceFolders?: unknown[] }).workspaceFolders;
    (applyUserButtonIcon as jest.Mock).mockReturnValue(true);
    (resetUserButtonIcon as jest.Mock).mockReturnValue(true);
    (applyButtonManifest as jest.Mock).mockReturnValue(true);
  });

  function setupConfigurator(configOverrides: Partial<{
    inspect: jest.Mock;
    get: jest.Mock;
    update: jest.Mock;
  }> = {}) {
    const subscriptions: unknown[] = [];
    let messageHandler: ((message: unknown) => Promise<void>) | undefined;
    const update = configOverrides.update ?? jest.fn().mockResolvedValue(undefined);
    const config = {
      inspect: configOverrides.inspect ?? jest.fn(() => ({ defaultValue: [] })),
      get: configOverrides.get ?? jest.fn(() => undefined),
      update,
    };
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
    (window.createWebviewPanel as jest.Mock).mockReturnValue(panel);
    (commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });

    registerConfiguratorCommand({
      extensionPath: '/fake/ext',
      subscriptions,
    } as never);

    expect(commands.registerCommand).toHaveBeenCalledWith(
      'ShortcutMenuBarPlus.configureButtons',
      expect.any(Function)
    );
    expect(subscriptions).toHaveLength(1);

    const commandCallback = (commands.registerCommand as jest.Mock).mock.calls[0][1];
    commandCallback();

    return {
      config,
      getMessageHandler: () => messageHandler,
      panel,
      update,
    };
  }

  it('saves to global settings when no workspace is open', async () => {
    const { getMessageHandler, update } = setupConfigurator();

    await getMessageHandler()?.({
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

    expect(update).toHaveBeenCalledWith('buttons', expect.any(Array), 1);
  });

  it('saves to global settings when a workspace is open', async () => {
    (workspace as unknown as { workspaceFolders?: unknown[] }).workspaceFolders = [
      { uri: { fsPath: '/workspace' } },
    ];
    const { getMessageHandler, update } = setupConfigurator();

    await getMessageHandler()?.({
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

    expect(update).toHaveBeenCalledWith('buttons', expect.any(Array), 1);
    delete (workspace as unknown as { workspaceFolders?: unknown[] }).workspaceFolders;
  });

  it('registers the configure command and saves normalized buttons', async () => {
    const { getMessageHandler, panel, update } = setupConfigurator();

    expect(panel.webview.onDidReceiveMessage).toHaveBeenCalledWith(expect.any(Function));
    expect(getMessageHandler()).toBeDefined();

    await getMessageHandler()?.({
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

    expect(update).toHaveBeenCalledWith(
      'buttons',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'userButton01',
          type: 'user',
          enabled: true,
          command: 'workbench.action.showCommands',
          label: 'Commands',
          icon: '',
        }),
      ]),
      1
    );
    expect(resetUserButtonIcon).toHaveBeenCalledWith('01', '/fake/ext');
    expect(applyButtonManifest).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'userButton01' }),
      ]),
      '/fake/ext',
      { visibilityMode: 'structured' }
    );
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'saved',
      needsReload: true,
    });
    expect(window.showInformationMessage).toHaveBeenCalledTimes(1);
    expect(consumeConfiguratorButtonSave()).toBe(true);
    expect(consumeConfiguratorButtonSave()).toBe(false);
  });

  it('ignores malformed messages', async () => {
    const { getMessageHandler, update } = setupConfigurator();

    await getMessageHandler()?.({ type: 'save', buttons: 'not-an-array' });
    await getMessageHandler()?.({ type: 'unknown', buttons: [] });

    expect(update).not.toHaveBeenCalled();
    expect(applyButtonManifest).not.toHaveBeenCalled();
    expect(window.showInformationMessage).not.toHaveBeenCalled();
    expect(consumeConfiguratorButtonSave()).toBe(false);
  });

  it('ignores reload messages until a reload-relevant save succeeds', async () => {
    const { getMessageHandler } = setupConfigurator();

    await getMessageHandler()?.({ type: 'reload' });

    expect(commands.executeCommand).not.toHaveBeenCalledWith(
      'workbench.action.reloadWindow'
    );

    await getMessageHandler()?.({
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
    await getMessageHandler()?.({ type: 'reload' });

    expect(commands.executeCommand).toHaveBeenCalledWith(
      'workbench.action.reloadWindow'
    );
    expect(consumeConfiguratorButtonSave()).toBe(true);
    expect(consumeConfiguratorButtonSave()).toBe(false);
  });

  it('uses explicitly configured empty buttons instead of legacy settings', () => {
    const get = jest.fn((key: string) => {
      if (key === 'buttons') {
        return [];
      }
      if (key === 'userButton01Command') {
        return 'legacy.command';
      }
      return undefined;
    });

    const { panel } = setupConfigurator({
      inspect: jest.fn(() => ({ globalValue: [] })),
      get,
    });

    expect(panel.webview.html).toContain('data-button-id="userButton01"');
    expect(panel.webview.html).not.toContain('legacy.command');
  });

  it('does not prompt again for an unchanged second save in the same panel', async () => {
    const { getMessageHandler, panel } = setupConfigurator();
    const message = {
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
    };

    await getMessageHandler()?.(message);
    await getMessageHandler()?.(message);

    expect(window.showInformationMessage).toHaveBeenCalledTimes(1);
    expect(panel.webview.postMessage).toHaveBeenLastCalledWith({
      type: 'saved',
      needsReload: true,
    });
    expect(consumeConfiguratorButtonSave()).toBe(true);
    expect(consumeConfiguratorButtonSave()).toBe(false);
  });

  it('clears the configurator marker when saving buttons fails', async () => {
    const updateError = new Error('settings write failed');
    const { getMessageHandler, panel } = setupConfigurator({
      update: jest.fn().mockRejectedValue(updateError),
    });

    await getMessageHandler()?.({
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

    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'saved',
      needsReload: false,
    });
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('settings write failed')
    );
    expect(consumeConfiguratorButtonSave()).toBe(false);
  });

  it('disables reload and clears marker when manifest apply fails', async () => {
    (applyButtonManifest as jest.Mock).mockReturnValue(false);
    const { getMessageHandler, panel } = setupConfigurator();

    await getMessageHandler()?.({
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

    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'saved',
      needsReload: false,
    });
    expect(window.showInformationMessage).not.toHaveBeenCalled();
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('applying toolbar icons or order failed')
    );
    expect(consumeConfiguratorButtonSave()).toBe(false);
  });

  it('revokes pending reload after a later manifest apply failure', async () => {
    const { getMessageHandler, panel } = setupConfigurator();
    const message = {
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
    };

    await getMessageHandler()?.(message);
    (applyButtonManifest as jest.Mock).mockReturnValue(false);
    await getMessageHandler()?.({
      type: 'save',
      buttons: [
        {
          id: 'userButton02',
          type: 'user',
          enabled: true,
          command: 'workbench.action.showCommands',
          label: 'Commands 2',
          icon: '',
        },
      ],
    });

    expect(panel.webview.postMessage).toHaveBeenLastCalledWith({
      type: 'saved',
      needsReload: false,
    });
    await getMessageHandler()?.({ type: 'reload' });
    expect(commands.executeCommand).not.toHaveBeenCalledWith(
      'workbench.action.reloadWindow'
    );
    expect(consumeConfiguratorButtonSave()).toBe(false);
  });

  it('disables reload and clears marker when icon apply fails', async () => {
    (applyUserButtonIcon as jest.Mock).mockReturnValue(false);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { getMessageHandler, panel } = setupConfigurator();

    await getMessageHandler()?.({
      type: 'save',
      buttons: [
        {
          id: 'userButton01',
          type: 'user',
          enabled: true,
          command: 'workbench.action.showCommands',
          label: 'Commands',
          icon: 'commands',
        },
      ],
    });

    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'saved',
      needsReload: false,
    });
    expect(window.showInformationMessage).not.toHaveBeenCalled();
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('applying toolbar icons or order failed')
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('button indexes: 01')
    );
    expect(consumeConfiguratorButtonSave()).toBe(false);

    errorSpy.mockRestore();
  });

  it('attempts all user icon updates before reporting failed indexes', async () => {
    (applyUserButtonIcon as jest.Mock).mockImplementation((buttonIndex: string) =>
      buttonIndex !== '01'
    );
    (resetUserButtonIcon as jest.Mock).mockImplementation((buttonIndex: string) =>
      buttonIndex !== '03'
    );
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { getMessageHandler } = setupConfigurator();

    await getMessageHandler()?.({
      type: 'save',
      buttons: [
        {
          id: 'userButton01',
          type: 'user',
          enabled: true,
          command: 'workbench.action.showCommands',
          label: 'Commands',
          icon: 'commands',
        },
        {
          id: 'userButton02',
          type: 'user',
          enabled: true,
          command: 'workbench.action.quickOpen',
          label: 'Quick Open',
          icon: 'search',
        },
        {
          id: 'userButton03',
          type: 'user',
          enabled: true,
          command: 'workbench.action.files.save',
          label: 'Save',
          icon: '',
        },
      ],
    });

    expect(applyUserButtonIcon).toHaveBeenCalledWith('01', 'commands', '/fake/ext');
    expect(applyUserButtonIcon).toHaveBeenCalledWith('02', 'search', '/fake/ext');
    expect(resetUserButtonIcon).toHaveBeenCalledWith('03', '/fake/ext');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('button indexes: 01, 03')
    );

    errorSpy.mockRestore();
  });
});

interface ClientElement {
  addEventListener: (event: string, handler: (event?: { data?: unknown }) => void) => void;
  checked?: boolean;
  click: () => void;
  className?: string;
  classList: {
    add: (className: string) => void;
    contains: (className: string) => boolean;
    remove: (className: string) => void;
    toggle: (className: string, force?: boolean) => void;
  };
  dataset: Record<string, string>;
  disabled?: boolean;
  dispatch: (event: string) => void;
  focus: () => void;
  hidden?: boolean;
  parentElement?: {
    insertBefore: (row: ClientElement, target: ClientElement) => void;
  };
  querySelector: (selector: string) => ClientElement;
  querySelectorAll: (selector: string) => ClientElement[];
  value?: string;
  visible?: boolean;
}

function runClientScript(html: string): {
  elements: Record<string, ClientElement>;
  iconPickers: ClientElement[];
  list: {
    insertBefore: (row: ClientElement, target: ClientElement) => void;
  };
  messages: unknown[];
  rows: ClientElement[];
  sendWindowMessage: (data: unknown) => void;
} {
  const scriptMatch = html.match(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/i);
  if (!scriptMatch) {
    throw new Error('Expected rendered HTML to include a script.');
  }

  const messages: unknown[] = [];
  const listeners = new Map<string, Array<(event?: { data?: unknown }) => void>>();
  const list = {
    insertBefore: (row: ClientElement, target: ClientElement): void => {
      rows.splice(rows.indexOf(row), 1);
      const targetIndex = rows.indexOf(target);
      rows.splice(targetIndex === -1 ? rows.length : targetIndex, 0, row);
    },
  };
  const rows = [
    createRow({
      id: 'save',
      type: 'builtin',
      enabled: true,
      parentElement: list,
    }),
    createRow({
      id: 'userButton01',
      type: 'user',
      enabled: false,
      command: 'workbench.action.showCommands',
      label: 'Commands',
      icon: 'commands',
      parentElement: list,
    }),
  ];
  const elements: Record<string, ClientElement> = {
    saveTop: createElement(),
    saveBottom: createElement(),
    reloadTop: createElement({ disabled: true }),
    reloadBottom: createElement({ disabled: true }),
    reloadBanner: createElement(),
    endDropZone: createElement(),
  };
  const saveButtons = [elements.saveTop, elements.saveBottom];
  const reloadButtons = [elements.reloadTop, elements.reloadBottom];
  const iconPickers = rows
    .map((row) => row.querySelector('.icon-picker'))
    .filter(Boolean);

  const documentStub = {
    addEventListener: (
      event: string,
      handler: (event?: { target?: { closest: () => ClientElement | undefined } }) => void
    ) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler as never]);
    },
    getElementById: (id: string) => {
      if (id === 'reload-banner') {
        return elements.reloadBanner;
      }
      if (id === 'end-drop-zone') {
        return elements.endDropZone;
      }
      return elements[id];
    },
    querySelector: (selector: string) => (selector === '.button-list' ? list : undefined),
    querySelectorAll: (selector: string) => {
      if (selector === '.button-row') {
        return rows;
      }
      if (selector === '.save-button') {
        return saveButtons;
      }
      if (selector === '.reload-button') {
        return reloadButtons;
      }
      if (selector === '.icon-picker') {
        return iconPickers;
      }
      if (selector === '.icon-menu') {
        return iconPickers.map((picker) => picker.querySelector('.icon-menu'));
      }
      return [];
    },
  };
  const windowStub = {
    addEventListener: (
      event: string,
      handler: (event?: { data?: unknown }) => void
    ) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    },
  };

  new Script(scriptMatch[1]).runInNewContext({
    acquireVsCodeApi: () => ({
      postMessage: (message: unknown) => {
        messages.push(message);
      },
    }),
    document: documentStub,
    window: windowStub,
  });

  return {
    elements,
    iconPickers,
    list,
    messages,
    rows,
    sendWindowMessage: (data: unknown) => {
      for (const handler of listeners.get('message') ?? []) {
        handler({ data });
      }
    },
  };
}

function createElement(
  options: Partial<
    Pick<
      ClientElement,
      'checked' | 'className' | 'dataset' | 'disabled' | 'value' | 'parentElement'
    >
  > = {}
): ClientElement {
  const handlers = new Map<string, Array<(event?: { data?: unknown }) => void>>();
  const classes = new Set<string>();
  const element: ClientElement = {
    addEventListener: (event, handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    checked: options.checked,
    className: options.className,
    classList: {
      add: (className) => {
        classes.add(className);
        if (className === 'visible') {
          element.visible = true;
        }
      },
      contains: (className) => classes.has(className),
      remove: (className) => {
        classes.delete(className);
        if (className === 'visible') {
          element.visible = false;
        }
      },
      toggle: (className, force) => {
        if (force === false) {
          classes.delete(className);
        } else {
          classes.add(className);
        }
        if (className === 'visible') {
          element.visible = force;
        }
      },
    },
    click: () => {
      for (const handler of handlers.get('click') ?? []) {
        handler({
          data: undefined,
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as never);
      }
    },
    dataset: options.dataset ?? {},
    disabled: options.disabled,
    dispatch: (event) => {
      for (const handler of handlers.get(event) ?? []) {
        handler({
          data: undefined,
          preventDefault: jest.fn(),
        } as never);
      }
    },
    focus: jest.fn(),
    hidden: false,
    parentElement: options.parentElement,
    querySelector: () => {
      throw new Error('querySelector not configured for element.');
    },
    querySelectorAll: () => [],
    value: options.value,
    visible: false,
  };
  return element;
}

function createRow(input: {
  command?: string;
  enabled: boolean;
  icon?: string;
  id: string;
  label?: string;
  parentElement: { insertBefore: (row: ClientElement, target: ClientElement) => void };
  type: string;
}): ClientElement {
  const controls: Record<string, ClientElement> = {
    '.enabled-toggle': createElement({ checked: input.enabled }),
    '.command-input': createElement({ value: input.command ?? '' }),
    '.label-input': createElement({ value: input.label ?? '' }),
    '.icon-input': createElement({ value: input.icon ?? '' }),
    '.icon-preview': createElement({ className: 'icon-preview codicon codicon-commands' }),
    '.icon-toggle': createElement(),
  };
  const iconOptions = [
    createElement({ dataset: { icon: 'add' } }),
    createElement({ dataset: { icon: 'commands' } }),
  ];
  const iconMenu = createElement();
  const iconPicker = createElement();
  iconPicker.querySelector = (selector) => {
    if (selector === '.icon-input') {
      return controls['.icon-input'];
    }
    if (selector === '.icon-preview') {
      return controls['.icon-preview'];
    }
    if (selector === '.icon-toggle') {
      return controls['.icon-toggle'];
    }
    if (selector === '.icon-menu') {
      return iconMenu;
    }
    throw new Error(`querySelector not configured for icon picker: ${selector}`);
  };
  iconPicker.querySelectorAll = (selector) =>
    selector === '.icon-option' ? iconOptions : [];
  controls['.icon-picker'] = iconPicker;
  const row = createElement({
    dataset: {
      buttonId: input.id,
      buttonType: input.type,
    },
    parentElement: input.parentElement,
  });
  row.querySelector = (selector) => controls[selector];
  return row;
}
