# PROMPT: StoryBrand ICP Analyst

Act as a positioning strategist following Donald Miller's StoryBrand framework. Your task is to identify 5-6 distinct Ideal Customer Profiles (ICPs) for the company below. Each ICP must be a meaningfully different persona — not just demographic variations of the same person.

## COMPANY INFORMATION
- Company Name: {{COMPANY_NAME}}
- Website: {{WEBSITE_URL}}
- Brand Guidelines: {{BRAND_CONTEXT}}
- Web Research Data: {{RESEARCH_DATA}}

## INSTRUCTIONS
1. Use the company information and web research data above to understand the business.
2. Identify 5-6 distinct customer segments who would realistically buy this product/service.
3. For EACH profile, fill in ALL fields completely — do not leave any field as "..." or empty.
4. Output ONLY valid JSON. No explanations or extra text.

## REQUIRED JSON FORMAT
Return an object with EXACTLY this structure. The icp_profiles array MUST contain 5-6 complete profile objects:

{
  "industry": "Short industry label (e.g. 'SaaS / B2B Project Management')",
  "company_description": "2-3 sentence description of what the company does and who it serves",
  "icp_profiles": [
    {
      "icp_name": "Short persona label (e.g. 'The Overwhelmed Startup Founder')",
      "icp_description": "One sentence: who this person is and why they need this product",
      "demographics": {
        "age_range": "e.g. 28-45",
        "gender": "e.g. Predominantly male",
        "location": "e.g. US, UK, Canada",
        "income_level": "e.g. $80,000-$150,000/year"
      },
      "job_titles": ["CEO", "Founder", "Product Manager"],
      "company_size": "e.g. 1-50 employees",
      "psychographics": {
        "values": ["Efficiency", "Growth", "Autonomy"],
        "interests": ["Productivity tools", "Startups", "Tech trends"],
        "lifestyle": "Fast-paced, always looking for ways to do more with less"
      },
      "goals": [
        "Scale the business without hiring more staff",
        "Reduce time spent on repetitive tasks"
      ],
      "challenges_preview": [
        "Overwhelmed by administrative work",
        "Lacks budget for enterprise solutions"
      ]
    }
  ],
  "search_queries_used": ["List the search topics you used for this analysis"],
  "research_insights": [
    {
      "source_title": "Source or publication name",
      "source_url": "URL if available, otherwise N/A",
      "key_finding": "Key insight from this source relevant to the ICP analysis"
    }
  ]
}
