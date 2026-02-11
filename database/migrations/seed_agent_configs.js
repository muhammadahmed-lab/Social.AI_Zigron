/**
 * Seed Script: Insert agent configurations into agent_configs table
 *
 * Usage: node database/migrations/seed_agent_configs.js
 *
 * Reads the 3 directive .md files and inserts them with their
 * corresponding system prompts and search query templates.
 */
// Resolve modules from backend/node_modules since this script lives in database/migrations/
const backendDir = require('path').join(__dirname, '../../backend');
const { createClient } = require(require('path').join(backendDir, 'node_modules/@supabase/supabase-js'));
const dotenv = require(require('path').join(backendDir, 'node_modules/dotenv'));
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const agents = [
    {
        agent_id: 1,
        name: 'ICP Analyst',
        description: 'StoryBrand ICP Analyst — identifies ideal customer profiles using web research and brand context.',
        system_prompt: 'You are a StoryBrand Strategist.',
        directive_file: 'icp_analyst.md',
        search_query_template: '{{COMPANY_NAME}} {{WEBSITE_URL}} target audience industry segments and positioning',
    },
    {
        agent_id: 2,
        name: 'Problem Identifier',
        description: 'ICP Problem Identification Expert — analyzes top 10 customer pain points and frustrations.',
        system_prompt: 'You are a Problem Identification Expert.',
        directive_file: 'icp_problem_id.md',
        search_query_template: '{{INDUSTRY}} {{WEBSITE_URL}} customer pain points quora reddit frustrations',
    },
    {
        agent_id: 3,
        name: 'Content Calendar Strategist',
        description: 'StoryBrand Content Strategist — generates strategic content calendars with AI visual prompts.',
        system_prompt: 'You are a Content Strategist.',
        directive_file: 'content_calendar.md',
        search_query_template: null,
    },
];

async function seed() {
    console.log('Seeding agent_configs...\n');

    for (const agent of agents) {
        const directivePath = path.join(__dirname, '../../directives', agent.directive_file);
        let directiveTemplate;
        try {
            directiveTemplate = fs.readFileSync(directivePath, 'utf-8');
        } catch (err) {
            console.error(`  [SKIP] Could not read ${agent.directive_file}: ${err.message}`);
            continue;
        }

        const { error } = await supabase
            .from('agent_configs')
            .upsert({
                agent_id: agent.agent_id,
                name: agent.name,
                description: agent.description,
                system_prompt: agent.system_prompt,
                directive_template: directiveTemplate,
                search_query_template: agent.search_query_template,
            }, { onConflict: 'agent_id' });

        if (error) {
            console.error(`  [ERROR] Agent ${agent.agent_id} (${agent.name}): ${error.message}`);
        } else {
            console.log(`  [OK] Agent ${agent.agent_id}: ${agent.name}`);
        }
    }

    console.log('\nDone. Remember to set admin role:');
    console.log("  UPDATE users SET role = 'admin' WHERE email = 'your@email.com';");
}

seed().catch(console.error);
