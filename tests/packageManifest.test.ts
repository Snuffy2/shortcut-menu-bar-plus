import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('extension package metadata', () => {
  it('activates after startup so saved manifest customizations are restored', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
    );

    expect(pkg.activationEvents).toContain('onStartupFinished');
  });

});
