import * as fs from 'fs';
import * as path from 'path';
import { BUILTIN_BUTTONS, ButtonEntry, USER_BUTTONS } from '../src/buttonModel';
import { applyButtonManifest } from '../src/manifestUpdater';

jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

function allBuiltinEntries(enabled: boolean): ButtonEntry[] {
  return BUILTIN_BUTTONS.map((button) => ({
    id: button.id,
    type: 'builtin' as const,
    enabled,
  }));
}

function userEntriesFromOverrides(
  override: Record<string, { label?: string; command?: string; enabled?: boolean }> = {}
): ButtonEntry[] {
  return USER_BUTTONS.map((button) => {
    const config = override[button.id];
    return {
      id: button.id,
      type: 'user' as const,
      enabled: config?.enabled ?? false,
      command: config?.command ?? '',
      label: config?.label ?? '',
      icon: '',
    };
  });
}

function allCommands() {
  return [...BUILTIN_BUTTONS, ...USER_BUTTONS].map((button) => ({
    command: button.commandId,
    title: button.type === 'user' ? button.defaultTitle : `command ${button.id}`,
  }));
}

function allEditorMenus() {
  return [...BUILTIN_BUTTONS, ...USER_BUTTONS].map((button) => ({
    command: button.commandId,
    when: `managed:${button.id}`,
    group: 'navigation@0',
  }));
}

function makePkg(args: {
  commands: Array<{ command: string; title: string }>;
  editorTitle: Array<{ [key: string]: unknown }>;
}) {
  return JSON.stringify(
    {
      name: 'Shortcut Menu Bar Plus',
      contributes: {
        commands: args.commands,
        menus: {
          'editor/title': args.editorTitle,
        },
      },
      extra: {
        untouched: true,
      },
    },
    null,
    2
  );
}

describe('applyButtonManifest', () => {
  const extensionPath = '/fake/ext';
  const pkgPath = path.join(extensionPath, 'package.json');
  const allEntries = [
    ...allBuiltinEntries(false),
    ...userEntriesFromOverrides(),
  ] as ButtonEntry[];
  const INTERNAL_ORIGINAL_WHEN_KEY = 'shortcutMenuBarPlusOriginalWhen';

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.renameSync.mockImplementation(() => undefined);
  });

  it('writes atomically with tmp file + rename', () => {
    mockFs.readFileSync.mockReturnValue(
      makePkg({
        commands: allCommands(),
        editorTitle: allEditorMenus(),
      })
    );
    mockFs.writeFileSync.mockImplementation(() => undefined);

    applyButtonManifest(allEntries, extensionPath);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      `${pkgPath}.tmp`,
      expect.any(String),
      'utf8'
    );
    expect(mockFs.renameSync).toHaveBeenCalledWith(`${pkgPath}.tmp`, pkgPath);
    const written = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    expect(written).toMatch(/\n$/);
  });

  it('does not rewrite when manifest content is already current', () => {
    const entries: ButtonEntry[] = [
      ...allBuiltinEntries(false),
      ...userEntriesFromOverrides({
        userButton01: { command: 'cmd', label: 'Build', enabled: true },
      }),
    ];
    mockFs.readFileSync.mockReturnValue(
      makePkg({
        commands: allCommands(),
        editorTitle: allEditorMenus(),
      })
    );
    mockFs.writeFileSync.mockImplementation(() => undefined);

    applyButtonManifest(entries, extensionPath);

    const written = (mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
    mockFs.writeFileSync.mockClear();
    mockFs.renameSync.mockClear();
    mockFs.readFileSync.mockReturnValue(written);

    const result = applyButtonManifest(entries, extensionPath);

    expect(result).toBe(true);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(mockFs.renameSync).not.toHaveBeenCalled();
  });

  it('returns false and warns when a required user-button command contribution is missing', () => {
    const [badUser, ...goodUsers] = USER_BUTTONS;
    const commands = [
      ...goodUsers.map((button) => ({ command: button.commandId, title: button.defaultTitle })),
      ...BUILTIN_BUTTONS.map((button) => ({ command: button.commandId, title: `command ${button.id}` })),
    ];

    mockFs.readFileSync.mockReturnValue(
      makePkg({
        commands,
        editorTitle: allEditorMenus(),
      })
    );
    mockFs.writeFileSync.mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = applyButtonManifest(allEntries, extensionPath);

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('missingManagedCommands')
    );
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(mockFs.renameSync).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns false and warns when a required editor/title contribution is missing', () => {
    const editorTitle = [
      ...USER_BUTTONS.slice(0, 9).map((button) => ({
        command: button.commandId,
        group: 'navigation@1',
      })),
      ...BUILTIN_BUTTONS.map((button) => ({
        command: button.commandId,
        group: 'navigation@1',
      })),
    ];

    mockFs.readFileSync.mockReturnValue(
      makePkg({
        commands: allCommands(),
        editorTitle,
      })
    );
    mockFs.writeFileSync.mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = applyButtonManifest(allEntries, extensionPath);

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('missingEditorTitleCommands')
    );
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(mockFs.renameSync).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns false and warns when a required built-in command contribution is missing', () => {
    const [badBuiltin, ...goodBuiltins] = BUILTIN_BUTTONS;
    const commands = [
      ...goodBuiltins.map((button) => ({ command: button.commandId, title: `command ${button.id}` })),
      ...USER_BUTTONS.map((button) => ({ command: button.commandId, title: button.defaultTitle })),
    ];

    mockFs.readFileSync.mockReturnValue(
      makePkg({
        commands,
        editorTitle: allEditorMenus(),
      })
    );
    mockFs.writeFileSync.mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = applyButtonManifest(allEntries, extensionPath);

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('missingManagedCommands'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(badBuiltin.commandId));
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(mockFs.renameSync).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns false and logs read failure with pkgPath, code, and message', () => {
    const readError = new Error('permission denied') as NodeJS.ErrnoException;
    readError.code = 'EACCES';
    mockFs.readFileSync.mockImplementation(() => {
      throw readError;
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = applyButtonManifest(allEntries, extensionPath);

    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(pkgPath),
      expect.objectContaining({ code: 'EACCES' })
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('code=EACCES'),
      expect.anything()
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('permission denied'),
      expect.anything()
    );
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(mockFs.renameSync).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('updates user button titles using trimmed label or default title', () => {
    mockFs.readFileSync.mockReturnValue(
      makePkg({
        commands: allCommands(),
        editorTitle: allEditorMenus(),
      })
    );
    mockFs.writeFileSync.mockImplementation(() => undefined);

    const entries: ButtonEntry[] = [
      ...allBuiltinEntries(false),
      ...userEntriesFromOverrides({
        userButton01: { command: 'task', label: '  Build It  ', enabled: true },
        userButton10: { enabled: false },
      }),
    ];

    applyButtonManifest(entries, extensionPath);

    const written = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const user01 = written.contributes.commands.find(
      (command: { command: string; title: string }) =>
        command.command === 'ShortcutMenuBarPlus.userButton01'
    );
    const user10 = written.contributes.commands.find(
      (command: { command: string; title: string }) =>
        command.command === 'ShortcutMenuBarPlus.userButton10'
    );
    expect(user01.title).toBe('Build It');
    expect(user10.title).toBe('user action 0');
  });

  it('rewrites managed menu order for enabled entries with navigation groups', () => {
    const commands = allCommands();
    const editorTitle = allEditorMenus().map((menu, index) => ({
      ...menu,
      when: `cond-${index}`,
    }));
    mockFs.readFileSync.mockReturnValue(makePkg({ commands, editorTitle }));
    mockFs.writeFileSync.mockImplementation(() => undefined);

    const entries: ButtonEntry[] = [
      ...allBuiltinEntries(false),
      ...userEntriesFromOverrides({
        userButton01: { command: 'cmd', label: 'Build', enabled: true },
        userButton02: { command: 'cmd', label: 'Run', enabled: true },
      }),
    ];

    applyButtonManifest(entries, extensionPath);

    const written = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const editorMenus = written.contributes.menus['editor/title'];

    const managed01 = editorMenus.find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.userButton01'
    );
    const managed02 = editorMenus.find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.userButton02'
    );

    expect(managed01).toEqual(
      expect.objectContaining({
        when: expect.stringMatching(/^cond-/),
        group: 'navigation@1',
      })
    );
    expect(managed02).toEqual(
      expect.objectContaining({
        when: expect.stringMatching(/^cond-/),
        group: 'navigation@2',
      })
    );
  });

  it('removes the legacy built-in config predicate when enabling through the button model', () => {
    const commands = allCommands();
    const editorTitle = allEditorMenus().map((menu) =>
      menu.command === 'ShortcutMenuBarPlus.save'
        ? {
            ...menu,
            when: '!isInDiffEditor && !markdownPreviewFocus && config.ShortcutMenuBarPlus.save',
          }
        : menu
    );
    mockFs.readFileSync.mockReturnValue(makePkg({ commands, editorTitle }));
    mockFs.writeFileSync.mockImplementation(() => undefined);

    const entries: ButtonEntry[] = [
      ...allBuiltinEntries(false).map((entry) =>
        entry.id === 'save' ? { ...entry, enabled: true } : entry
      ),
      ...userEntriesFromOverrides(),
    ];

    applyButtonManifest(entries, extensionPath);

    const written = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const editorMenus = written.contributes.menus['editor/title'];
    const saveMenu = editorMenus.find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.save'
    );

    expect(saveMenu).toEqual(
      expect.objectContaining({
        when: '!isInDiffEditor && !markdownPreviewFocus',
        group: 'navigation@1',
      })
    );
  });

  it('removes the legacy user command predicate when enabling through the button model', () => {
    const commands = allCommands();
    const editorTitle = allEditorMenus().map((menu) =>
      menu.command === 'ShortcutMenuBarPlus.userButton01'
        ? {
            ...menu,
            when: 'config.ShortcutMenuBarPlus.userButton01Command',
          }
        : menu
    );
    mockFs.readFileSync.mockReturnValue(makePkg({ commands, editorTitle }));
    mockFs.writeFileSync.mockImplementation(() => undefined);

    const entries: ButtonEntry[] = [
      ...allBuiltinEntries(false),
      ...userEntriesFromOverrides({
        userButton01: { command: 'workbench.action.showCommands', enabled: true },
      }),
    ];

    applyButtonManifest(entries, extensionPath);

    const written = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const editorMenus = written.contributes.menus['editor/title'];
    const userButton01 = editorMenus.find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.userButton01'
    );

    expect(userButton01).toEqual(
      expect.objectContaining({
        group: 'navigation@1',
      })
    );
    expect(userButton01).not.toHaveProperty('when');
  });

  it('preserves legacy config predicates instead of baking legacy visibility snapshots', () => {
    const commands = allCommands();
    const editorTitle = allEditorMenus().map((menu) =>
      menu.command === 'ShortcutMenuBarPlus.save'
        ? {
            ...menu,
            when: 'config.ShortcutMenuBarPlus.save',
          }
        : menu
    );
    mockFs.readFileSync.mockReturnValue(makePkg({ commands, editorTitle }));
    mockFs.writeFileSync.mockImplementation(() => undefined);

    const disabledEntries: ButtonEntry[] = [
      ...allBuiltinEntries(false),
      ...userEntriesFromOverrides(),
    ];

    applyButtonManifest(disabledEntries, extensionPath, {
      visibilityMode: 'legacy',
    });

    const firstWrite = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const firstSaveMenu = firstWrite.contributes.menus['editor/title'].find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.save'
    );
    expect(firstSaveMenu).toEqual(
      expect.objectContaining({
        when: 'config.ShortcutMenuBarPlus.save',
      })
    );

    mockFs.writeFileSync.mockClear();
    mockFs.readFileSync.mockReturnValue(JSON.stringify(firstWrite));

    const enabledEntries: ButtonEntry[] = [
      ...allBuiltinEntries(false).map((entry) =>
        entry.id === 'save' ? { ...entry, enabled: true } : entry
      ),
      ...userEntriesFromOverrides(),
    ];

    applyButtonManifest(enabledEntries, extensionPath, {
      visibilityMode: 'legacy',
    });

    const secondWrite = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const secondSaveMenu = secondWrite.contributes.menus['editor/title'].find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.save'
    );
    expect(secondSaveMenu).toEqual(
      expect.objectContaining({
        when: 'config.ShortcutMenuBarPlus.save',
      })
    );
  });

  it('restores hidden structured menu items back to legacy config predicates', () => {
    const commands = allCommands();
    const editorTitle = allEditorMenus().map((menu) =>
      menu.command === 'ShortcutMenuBarPlus.userButton01'
        ? {
            ...menu,
            when: 'false',
            [INTERNAL_ORIGINAL_WHEN_KEY]: 'config.ShortcutMenuBarPlus.userButton01Command',
          }
        : menu
    );
    mockFs.readFileSync.mockReturnValue(makePkg({ commands, editorTitle }));
    mockFs.writeFileSync.mockImplementation(() => undefined);

    applyButtonManifest(allEntries, extensionPath, {
      visibilityMode: 'legacy',
    });

    const written = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const userButton01 = written.contributes.menus['editor/title'].find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.userButton01'
    );

    expect(userButton01).toEqual(
      expect.objectContaining({
        when: 'config.ShortcutMenuBarPlus.userButton01Command',
      })
    );
    expect(userButton01).not.toHaveProperty(INTERNAL_ORIGINAL_WHEN_KEY);
  });

  it('orders enabled managed entries in normalizeButtonModel order', () => {
    const commands = allCommands();
    const editorTitle = allEditorMenus().map((menu) => ({
      ...menu,
      when: `managed:${menu.command}`,
    }));
    mockFs.readFileSync.mockReturnValue(makePkg({ commands, editorTitle }));
    mockFs.writeFileSync.mockImplementation(() => undefined);

    const entries: ButtonEntry[] = [
      ...allBuiltinEntries(false),
      {
        id: 'userButton02',
        type: 'user',
        enabled: true,
        command: 'echo2',
        label: 'Run',
        icon: '',
      },
      {
        id: 'userButton01',
        type: 'user',
        enabled: true,
        command: 'echo1',
        label: 'Build',
        icon: '',
      },
    ];

    applyButtonManifest(entries, extensionPath);

    const written = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const editorMenus = written.contributes.menus['editor/title'];

    const managed02 = editorMenus.find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.userButton02'
    );
    const managed01 = editorMenus.find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.userButton01'
    );

    expect(managed02).toEqual(
      expect.objectContaining({
        group: 'navigation@1',
      })
    );
    expect(managed01).toEqual(
      expect.objectContaining({
        group: 'navigation@2',
      })
    );
  });

  it('restores original menu when after disable/enable round-trip', () => {
    const baseMenus = allEditorMenus().map((menu) => ({
      ...menu,
      when: `original:${menu.command}`,
    }));
    mockFs.readFileSync.mockReturnValue(
      makePkg({
        commands: allCommands(),
        editorTitle: baseMenus,
      })
    );
    mockFs.writeFileSync.mockImplementation(() => undefined);

    const disableEntries: ButtonEntry[] = [
      ...allBuiltinEntries(false),
      {
        id: 'userButton01',
        type: 'user',
        enabled: false,
        command: 'run',
        label: 'User 1',
        icon: '',
      },
    ];

    applyButtonManifest(disableEntries, extensionPath);

    const firstWrite = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const firstMenus = firstWrite.contributes.menus['editor/title'];
    const firstManaged01 = firstMenus.find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.userButton01'
    );
    expect(firstManaged01).toEqual(
      expect.objectContaining({
        when: 'false',
      })
    );

    mockFs.writeFileSync.mockClear();
    mockFs.readFileSync.mockReturnValue(JSON.stringify(firstWrite));

    const enableEntries: ButtonEntry[] = [
      ...allBuiltinEntries(false),
      {
        id: 'userButton01',
        type: 'user',
        enabled: true,
        command: 'run',
        label: 'User 1',
        icon: '',
      },
    ];

    applyButtonManifest(enableEntries, extensionPath);

    const secondWrite = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const secondMenus = secondWrite.contributes.menus['editor/title'];
    const secondManaged01 = secondMenus.find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.userButton01'
    );
    expect(secondManaged01).toEqual(
      expect.objectContaining({
        when: 'original:ShortcutMenuBarPlus.userButton01',
      })
    );
  });

  it('preserves disabled managed entries with deterministic hidden when and later grouping', () => {
    mockFs.readFileSync.mockReturnValue(
      makePkg({
        commands: allCommands(),
        editorTitle: allEditorMenus().map((menu, index) => ({
          ...menu,
          when: `original-when-${index}`,
        })),
      })
    );
    mockFs.writeFileSync.mockImplementation(() => undefined);

    const entries: ButtonEntry[] = [
      ...allBuiltinEntries(false),
      ...userEntriesFromOverrides({
        userButton01: { command: 'cmd', label: 'Build', enabled: false },
        userButton02: { command: 'cmd', label: 'Run', enabled: true },
      }),
    ];

    applyButtonManifest(entries, extensionPath);

    const written = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const editorMenus = written.contributes.menus['editor/title'];

    const managed01 = editorMenus.find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.userButton01'
    );
    const managed02 = editorMenus.find(
      (menu: { command: string }) => menu.command === 'ShortcutMenuBarPlus.userButton02'
    );

    expect(managed02).toEqual(
      expect.objectContaining({
        when: expect.stringMatching(/^original-when-/),
        group: 'navigation@1',
      })
    );
    expect(managed01).toEqual(expect.objectContaining({ when: 'false' }));
    expect(managed01.group).toMatch(/^navigation@\d+$/);
  });

  it('preserves unknown menu entries and places them after managed menu entries', () => {
    mockFs.readFileSync.mockReturnValue(
      makePkg({
        commands: allCommands(),
        editorTitle: [
          ...allEditorMenus().map((menu, index) => ({
            ...menu,
            when: `managed-when-${index}`,
          })),
          { command: 'extension.unknown.one', when: 'keep', group: 'navigation@20' },
          { command: 'extension.unknown.two', when: 'keep', group: 'navigation@10' },
        ],
      })
    );
    mockFs.writeFileSync.mockImplementation(() => undefined);

    applyButtonManifest(allEntries, extensionPath);

    const written = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const editorMenus = written.contributes.menus['editor/title'];
    const knownCount = [...BUILTIN_BUTTONS, ...USER_BUTTONS].length;
    const unknownOneIndex = editorMenus.findIndex(
      (menu: { command: string }) => menu.command === 'extension.unknown.one'
    );
    const unknownTwoIndex = editorMenus.findIndex(
      (menu: { command: string }) => menu.command === 'extension.unknown.two'
    );

    expect(unknownOneIndex).toBe(knownCount);
    expect(unknownTwoIndex).toBe(knownCount + 1);
    expect(unknownOneIndex).toBeGreaterThan(-1);
    expect(unknownTwoIndex).toBeGreaterThan(unknownOneIndex);
  });

  it('preserves command-less editor/title menu items after managed entries', () => {
    mockFs.readFileSync.mockReturnValue(
      makePkg({
        commands: allCommands(),
        editorTitle: [
          ...allEditorMenus().map((menu, index) => ({
            ...menu,
            when: `managed-when-${index}`,
          })),
          { command: 'extension.unknown.one', when: 'keep', group: 'navigation@20' },
          { submenu: 'some.submenu', when: 'submenu-visible', group: 'navigation@500' },
          { icon: '$(add)', when: 'menu-visible', group: 'navigation@501' },
        ],
      })
    );
    mockFs.writeFileSync.mockImplementation(() => undefined);

    applyButtonManifest(allEntries, extensionPath);

    const written = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    const editorMenus = written.contributes.menus['editor/title'];
    const knownCount = [...BUILTIN_BUTTONS, ...USER_BUTTONS].length;
    const unknownOneIndex = editorMenus.findIndex(
      (menu: { command: string }) => menu.command === 'extension.unknown.one'
    );
    const submenuIndex = editorMenus.findIndex(
      (menu: { submenu?: string }) => menu.submenu === 'some.submenu'
    );
    const iconIndex = editorMenus.findIndex(
      (menu: { icon?: string }) => menu.icon === '$(add)'
    );

    expect(unknownOneIndex).toBe(knownCount);
    expect(submenuIndex).toBe(knownCount + 1);
    expect(iconIndex).toBe(knownCount + 2);
  });

  it('preserves unrelated manifest content', () => {
    mockFs.readFileSync.mockReturnValue(
      makePkg({
        commands: allCommands(),
        editorTitle: allEditorMenus(),
      })
    );
    mockFs.writeFileSync.mockImplementation(() => undefined);

    applyButtonManifest(allEntries, extensionPath);

    const written = JSON.parse((mockFs.writeFileSync as jest.Mock).mock.calls[0][1] as string);
    expect(written.name).toBe('Shortcut Menu Bar Plus');
    expect(written.extra).toEqual({ untouched: true });
  });

  it('returns false without writing when required top-level contributions are missing', () => {
    mockFs.readFileSync.mockReturnValue(JSON.stringify({}));
    mockFs.writeFileSync.mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = applyButtonManifest(allEntries, extensionPath);

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('package.json is missing command or editor/title contributions.')
    );
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(mockFs.renameSync).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
