import * as path from 'path';
import type { ExecutorContext } from '../../config/misc-interfaces';
import { runCommand } from '../../native';
import { PseudoTtyProcess } from '../../utils/child-process';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { execSync } from 'child_process';

export interface RunScriptOptions {
  script: string;
  __unparsed__: string[];
}

export default async function (
  options: RunScriptOptions,
  context: ExecutorContext
) {
  const pm = getPackageManagerCommand();
  try {
    let command = pm.run(options.script, options.__unparsed__.join(' '));
    let cwd = path.join(
      context.root,
      context.projectsConfigurations.projects[context.projectName].root
    );
    let env = process.env;
    if (process.stdout.isTTY) {
      await ptyProcess(command, cwd, env);
    } else {
      nodeProcess(command, cwd, env);
    }
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

function nodeProcess(
  command: string,
  cwd: string,
  env: Record<string, string>
) {
  execSync(command, {
    stdio: ['inherit', 'inherit', 'inherit'],
    cwd,
    env,
  });
}

async function ptyProcess(
  command: string,
  cwd: string,
  env: Record<string, string>
) {
  return new Promise<void>((res, rej) => {
    const cp = new PseudoTtyProcess(runCommand(command, cwd, env));
    cp.onExit((code) => {
      if (code === 0) {
        res();
      } else if (code >= 128) {
        process.exit(code);
      } else {
        rej();
      }
    });
  });
}
