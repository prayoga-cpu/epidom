const fs = require('fs');
const path = 'd:/Projects/epidom/src/lib/services/subscription.service.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { NotFoundError')) {
  content = content.replace(
    'import { prisma } from "@/lib/prisma";',
    'import { prisma } from "@/lib/prisma";\nimport { NotFoundError, DuplicateError, ForbiddenError, ValidationError } from "@/lib/errors";'
  );
}

content = content.replace(/throw new Error\("User not found"\);/g, 'throw new NotFoundError("User");');
content = content.replace(/throw new Error\(`You already have an active \$\{plan\} plan`\);/g, 'throw new ValidationError(`You already have an active ${plan} plan`);');
content = content.replace(/throw new Error\([\s\n]+"Only one user is allowed for the basic plan\. Please upgrade to create more users\."[\s\n]+\);/g, 'throw new ValidationError("Only one user is allowed for the basic plan. Please upgrade to create more users.");');
content = content.replace(/throw new Error\("No subscription found for user"\);/g, 'throw new NotFoundError("Subscription");');
content = content.replace(/throw new Error\("No active subscription found"\);/g, 'throw new NotFoundError("Active Subscription");');
content = content.replace(/throw new Error\("No subscription found"\);/g, 'throw new NotFoundError("Subscription");');

content = content.replace(/throw new Error\([\s\n]+"Cannot downgrade to basic plan while you have multiple stores\. Please delete extra stores first\."[\s\n]+\);/g, 'throw new ValidationError("Cannot downgrade to basic plan while you have multiple stores. Please delete extra stores first.");');
content = content.replace(/throw new Error\([\s\n]+"Cannot downgrade to basic plan while you have multiple employees\. Please remove extra team members first\."[\s\n]+\);/g, 'throw new ValidationError("Cannot downgrade to basic plan while you have multiple employees. Please remove extra team members first.");');
content = content.replace(/throw new Error\([\s\n]+"Cannot downgrade to basic plan with your current data volume\. Basic plan is limited to 100 products and recipes\."[\s\n]+\);/g, 'throw new ValidationError("Cannot downgrade to basic plan with your current data volume. Basic plan is limited to 100 products and recipes.");');

fs.writeFileSync(path, content, 'utf8');
console.log('subscription.service.ts errors replaced');
