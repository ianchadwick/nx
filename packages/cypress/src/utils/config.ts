import type {
  InterfaceDeclaration,
  MethodSignature,
  ObjectLiteralExpression,
  PropertyAssignment,
  PropertySignature,
} from 'typescript';
import { NxCypressE2EPresetOptions } from '../../plugins/cypress-preset';

const TS_QUERY_COMMON_JS_EXPORT_SELECTOR =
  'BinaryExpression:has(Identifier[name="module"]):has(Identifier[name="exports"])';
const TS_QUERY_EXPORT_CONFIG_PREFIX = `:matches(ExportAssignment, ${TS_QUERY_COMMON_JS_EXPORT_SELECTOR}) `;

export async function addDefaultE2EConfig(
  cyConfigContents: string,
  options: NxCypressE2EPresetOptions,
  baseUrl: string
) {
  if (!cyConfigContents) {
    throw new Error('The passed in cypress config file is empty!');
  }
  const { tsquery } = await import('@phenomnomnominal/tsquery');

  const isCommonJS =
    tsquery.query(cyConfigContents, TS_QUERY_COMMON_JS_EXPORT_SELECTOR).length >
    0;
  const testingTypeConfig = tsquery.query<PropertyAssignment>(
    cyConfigContents,
    `${TS_QUERY_EXPORT_CONFIG_PREFIX} PropertyAssignment:has(Identifier[name="e2e"])`
  );

  let updatedConfigContents = cyConfigContents;

  if (testingTypeConfig.length === 0) {
    const configValue = `nxE2EPreset(__filename, ${JSON.stringify(options)})`;

    updatedConfigContents = tsquery.replace(
      cyConfigContents,
      `${TS_QUERY_EXPORT_CONFIG_PREFIX} ObjectLiteralExpression:first-child`,
      (node: ObjectLiteralExpression) => {
        let baseUrlContents = baseUrl ? `,\nbaseUrl: '${baseUrl}'` : '';
        if (node.properties.length > 0) {
          return `{
  ${node.properties.map((p) => p.getText()).join(',\n')},
  e2e: { ...${configValue}${baseUrlContents} } 
}`;
        }
        return `{
  e2e: { ...${configValue}${baseUrlContents} }
}`;
      }
    );

    return isCommonJS
      ? `const { nxE2EPreset } = require('@nx/cypress/plugins/cypress-preset');
    
    ${updatedConfigContents}`
      : `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
    
    ${updatedConfigContents}`;
  }
  return updatedConfigContents;
}

/**
 * Adds the nxComponentTestingPreset to the cypress config file
 * Make sure after calling this the correct import statement is addeda
 * to bring in the nxComponentTestingPreset function
 **/
export async function addDefaultCTConfig(
  cyConfigContents: string,
  options: { bundler?: string } = {}
) {
  if (!cyConfigContents) {
    throw new Error('The passed in cypress config file is empty!');
  }
  const { tsquery } = await import('@phenomnomnominal/tsquery');

  const testingTypeConfig = tsquery.query<PropertyAssignment>(
    cyConfigContents,
    `${TS_QUERY_EXPORT_CONFIG_PREFIX} PropertyAssignment:has(Identifier[name="component"])`
  );

  let updatedConfigContents = cyConfigContents;

  if (testingTypeConfig.length === 0) {
    const configValue =
      options?.bundler === 'vite'
        ? "nxComponentTestingPreset(__filename, { bundler: 'vite' })"
        : 'nxComponentTestingPreset(__filename)';

    updatedConfigContents = tsquery.replace(
      cyConfigContents,
      `${TS_QUERY_EXPORT_CONFIG_PREFIX} ObjectLiteralExpression:first-child`,
      (node: ObjectLiteralExpression) => {
        if (node.properties.length > 0) {
          return `{
  ${node.properties.map((p) => p.getText()).join(',\n')},
  component: ${configValue} 
}`;
        }
        return `{
  component: ${configValue}
}`;
      }
    );
  }
  return updatedConfigContents;
}

/**
 * Adds the mount command for Cypress
 * Make sure after calling this the correct import statement is added
 * to bring in the correct mount from cypress.
 **/
export async function addMountDefinition(cmpCommandFileContents: string) {
  if (!cmpCommandFileContents) {
    throw new Error('The passed in cypress component file is empty!');
  }
  const { tsquery } = await import('@phenomnomnominal/tsquery');
  const hasMountCommand =
    tsquery.query<MethodSignature | PropertySignature>(
      cmpCommandFileContents,
      'CallExpression StringLiteral[value="mount"]'
    )?.length > 0;

  if (hasMountCommand) {
    return cmpCommandFileContents;
  }

  const mountCommand = `Cypress.Commands.add('mount', mount);`;

  const updatedInterface = tsquery.replace(
    cmpCommandFileContents,
    'InterfaceDeclaration',
    (node: InterfaceDeclaration) => {
      return `interface ${node.name.getText()}${
        node.typeParameters
          ? `<${node.typeParameters.map((p) => p.getText()).join(', ')}>`
          : ''
      } {
      ${node.members.map((m) => m.getText()).join('\n      ')}
      mount: typeof mount;
    }`;
    }
  );
  return `${updatedInterface}\n${mountCommand}`;
}
