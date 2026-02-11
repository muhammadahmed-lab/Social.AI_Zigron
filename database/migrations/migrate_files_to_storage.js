// ===========================================
// File Migration Script: Base64 → Supabase Storage
// ===========================================
// This script migrates brand guideline files from Base64 storage
// in the brand_assets table to Supabase Storage bucket.
//
// IMPORTANT: Run AFTER the SQL migration (001_multicompany_setup.sql)
//
// Usage: node migrate_files_to_storage.js
// ===========================================

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateFilesToStorage() {
    console.log('🚀 Starting file migration to Supabase Storage...\n');

    try {
        // Step 1: Fetch all brand_assets with content
        console.log('📦 Fetching brand assets from database...');
        const { data: assets, error: fetchError } = await supabase
            .from('brand_assets')
            .select('id, user_id, brand_guidelines_content')
            .not('brand_guidelines_content', 'is', null);

        if (fetchError) {
            throw new Error(`Failed to fetch brand assets: ${fetchError.message}`);
        }

        console.log(`✅ Found ${assets?.length || 0} brand assets to migrate\n`);

        if (!assets || assets.length === 0) {
            console.log('✨ No files to migrate. Migration complete!');
            return;
        }

        let successCount = 0;
        let failCount = 0;

        // Step 2: Process each asset
        for (const asset of assets) {
            console.log(`📄 Processing asset ${asset.id}...`);

            try {
                // Get the user's active company
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('id, active_company_id')
                    .eq('id', asset.user_id)
                    .single();

                if (userError || !user || !user.active_company_id) {
                    console.log(`⚠️  Skipping asset ${asset.id}: User has no active company`);
                    failCount++;
                    continue;
                }

                // Decode Base64 content
                let buffer;
                try {
                    buffer = Buffer.from(asset.brand_guidelines_content, 'base64');
                } catch (e) {
                    // Try treating it as plain text if Base64 decode fails
                    buffer = Buffer.from(asset.brand_guidelines_content, 'utf-8');
                }

                // Generate file path
                const timestamp = Date.now();
                const filePath = `${user.active_company_id}/brand_guidelines_${timestamp}.txt`;

                // Upload to Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('company-files')
                    .upload(filePath, buffer, {
                        contentType: 'text/plain',
                        upsert: true
                    });

                if (uploadError) {
                    console.log(`❌ Failed to upload file for asset ${asset.id}: ${uploadError.message}`);
                    failCount++;
                    continue;
                }

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('company-files')
                    .getPublicUrl(filePath);

                // Create company_files record
                const { error: insertError } = await supabase
                    .from('company_files')
                    .insert({
                        company_id: user.active_company_id,
                        file_type: 'brand_guidelines',
                        file_name: 'brand_guidelines.txt',
                        file_path: filePath,
                        file_url: publicUrl,
                        mime_type: 'text/plain',
                        file_size: buffer.length
                    });

                if (insertError) {
                    console.log(`❌ Failed to create file record: ${insertError.message}`);
                    // Delete uploaded file to avoid orphans
                    await supabase.storage.from('company-files').remove([filePath]);
                    failCount++;
                    continue;
                }

                console.log(`✅ Migrated successfully: ${publicUrl}`);
                successCount++;

            } catch (error) {
                console.log(`❌ Error processing asset ${asset.id}: ${error.message}`);
                failCount++;
            }

            console.log(''); // Empty line for readability
        }

        // Summary
        console.log('\n===========================================');
        console.log('📊 Migration Summary');
        console.log('===========================================');
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Failed: ${failCount}`);
        console.log(`📦 Total: ${assets.length}`);
        console.log('===========================================\n');

        if (successCount > 0) {
            console.log('✨ Migration complete!');
            console.log('\n📝 Next steps:');
            console.log('1. Verify files in Supabase Storage dashboard');
            console.log('2. Test file access from frontend');
            console.log('3. Once verified, you can DROP the brand_assets table');
            console.log('   SQL: DROP TABLE brand_assets CASCADE;');
        } else {
            console.log('⚠️  No files were migrated. Please check errors above.');
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run migration
migrateFilesToStorage().catch(console.error);
