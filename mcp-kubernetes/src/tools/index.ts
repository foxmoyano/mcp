import type { Tool } from '../types.js';

import kubectlGet from './kubectlGet.js';
import kubectlDescribe from './kubectlDescribe.js';
import kubectlLogs from './kubectlLogs.js';
import kubectlApply from './kubectlApply.js';
import kubectlDelete from './kubectlDelete.js';
import kubectlExec from './kubectlExec.js';
import kubectlPortForward from './kubectlPortForward.js';
import kubectlRollout from './kubectlRollout.js';

export const tools: Tool[] = [
    kubectlGet,
    kubectlDescribe,
    kubectlLogs,
    kubectlApply,
    kubectlDelete,
    kubectlExec,
    kubectlPortForward,
    kubectlRollout,
];

export default tools;