import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSortRatio(a: string, b: string): number {
  const sortedA = a.split(" ").sort().join(" ");
  const sortedB = b.split(" ").sort().join(" ");
  return levenshteinRatio(sortedA, sortedB);
}

function levenshteinRatio(a: string, b: string): number {
  if (a.length === 0) return b.length === 0 ? 100 : 0;
  if (b.length === 0) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

function partialRatio(a: string, b: string): number {
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;

  if (shorter.length === 0) return 0;

  let maxRatio = 0;
  for (let i = 0; i <= longer.length - shorter.length; i++) {
    const substring = longer.substring(i, i + shorter.length);
    const ratio = levenshteinRatio(shorter, substring);
    maxRatio = Math.max(maxRatio, ratio);
  }

  return maxRatio;
}

function namesMatch(a: string, b: string, threshold = 80): boolean {
  if (!a || !b) return false;
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  return tokenSortRatio(normalizedA, normalizedB) >= threshold;
}

function projectMatch(a: string, b: string, threshold = 75): boolean {
  if (!a || !b) return false;
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  return partialRatio(normalizedA, normalizedB) >= threshold;
}

// Extract username from LinkedIn URL and normalize it
function extractNameFromLinkedInUrl(linkedinUrl: string): string {
  if (!linkedinUrl) return "";

  try {
    const url = new URL(linkedinUrl);
    const pathname = url.pathname;

    // LinkedIn post URLs: /posts/username-abc123_activity-...
    // LinkedIn profile URLs: /in/username/
    let username = "";

    if (pathname.includes("/posts/")) {
      // Extract from /posts/username-suffix
      const postsMatch = pathname.match(/\/posts\/([^_]+)/);
      if (postsMatch) {
        username = postsMatch[1];
      }
    } else if (pathname.includes("/in/")) {
      // Extract from /in/username/
      const inMatch = pathname.match(/\/in\/([^\/]+)/);
      if (inMatch) {
        username = inMatch[1];
      }
    }

    // Normalize: lowercase, replace hyphens/underscores with spaces, remove numbers and special chars
    const normalized = username
      .toLowerCase()
      .replace(/[-_]/g, " ")
      .replace(/[0-9]/g, "")
      .replace(/[^a-z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    console.log("Extracted LinkedIn username:", {
      original: username,
      normalized,
    });
    return normalized;
  } catch (error) {
    console.error("Error parsing LinkedIn URL:", error);
    return "";
  }
}

async function scrapeCourseraCertificate(
  url: string,
): Promise<{ name: string; course: string }> {
  try {
    console.log("Scraping Coursera URL with Firecrawl (DOM-aware):", url);

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
    
    if (!firecrawlApiKey) {
      console.log("FIRECRAWL_API_KEY not configured, falling back to basic fetch");
      return await scrapeCourseraBasic(url);
    }

    // Use Firecrawl for DOM-aware scraping with JavaScript rendering
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        formats: ["markdown", "html"],
        onlyMainContent: false, // Get full page to find "Completed by"
        waitFor: 3000, // Wait for dynamic content to load
      }),
    });

    if (!response.ok) {
      console.log("Firecrawl response not OK:", response.status);
      return await scrapeCourseraBasic(url);
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || "";
    const html = data.data?.html || data.html || "";
    
    console.log("Firecrawl markdown length:", markdown.length);
    console.log("Firecrawl HTML length:", html.length);

    let name = "";
    let course = "";

    // STRICT EXTRACTION: Only extract student name from "Completed by" pattern
    // Do NOT use any fallback values like page titles, site names, or metadata

    // Method 1: Extract from markdown (more reliable for visible text)
    const markdownPatterns = [
      /Completed by\s+\*\*([^*]+)\*\*/i, // **Name** format
      /Completed by\s+([A-Za-z][A-Za-z\s]{2,50})(?:\n|$|,|\.|!)/gi,
      /Completed by\s+([A-Za-z][A-Za-z\s]{2,50})/gi,
    ];

    for (const pattern of markdownPatterns) {
      const match = markdown.match(pattern);
      if (match && match[1]) {
        const extractedName = match[1].trim();
        if (extractedName.toLowerCase() !== "coursera" && 
            !extractedName.toLowerCase().includes("coursera") &&
            extractedName.length > 1 &&
            extractedName.length < 60) {
          name = extractedName;
          console.log("Extracted name from Firecrawl markdown:", name);
          break;
        }
      }
    }

    // Method 2: Extract from rendered HTML if markdown didn't work
    if (!name && html) {
      // Look for the specific Coursera class pattern
      const classPatterns = [
        /class="[^"]*cds-119[^"]*cds-Typography-base[^"]*css-h1jogs[^"]*cds-121[^"]*"[^>]*>([^<]*Completed by[^<]*)</gi,
        /cds-119[^>]*>([^<]*Completed by[^<]*)</gi,
      ];

      for (const pattern of classPatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          const content = match[1]?.trim();
          if (content && content.toLowerCase().includes("completed by")) {
            const nameMatch = content.match(/completed by\s+(.+)/i);
            if (nameMatch && nameMatch[1]) {
              const extractedName = nameMatch[1].trim();
              if (extractedName.toLowerCase() !== "coursera" && 
                  extractedName.length > 1 &&
                  !extractedName.toLowerCase().includes("coursera")) {
                name = extractedName;
                console.log("Extracted name from Firecrawl HTML class:", name);
                break;
              }
            }
          }
        }
        if (name) break;
      }

      // Method 3: General "Completed by" pattern in HTML
      if (!name) {
        const htmlPatterns = [
          /Completed by\s*<strong[^>]*>([^<]+)<\/strong>/gi,
          /Completed by\s*<b[^>]*>([^<]+)<\/b>/gi,
          /Completed by\s*<span[^>]*>([^<]+)<\/span>/gi,
          />Completed by\s+([A-Za-z][A-Za-z\s]{2,50})</gi,
          /Completed by\s+([A-Za-z][A-Za-z\s]{2,50})(?:<|,|\.|\||&|$)/gi,
        ];
        
        for (const pattern of htmlPatterns) {
          const matches = html.matchAll(pattern);
          for (const match of matches) {
            const extractedName = match[1]?.trim();
            if (extractedName && 
                extractedName.toLowerCase() !== "coursera" &&
                !extractedName.toLowerCase().includes("coursera") &&
                extractedName.length > 1 &&
                extractedName.length < 60) {
              name = extractedName;
              console.log("Extracted name from Firecrawl HTML pattern:", name);
              break;
            }
          }
          if (name) break;
        }
      }
    }

    // IMPORTANT: If no name found from "Completed by" pattern, leave as empty
    // Do NOT fallback to titles, h1, meta tags, or any other source
    if (!name) {
      console.log("WARNING: Could not find 'Completed by' pattern in Firecrawl response - no student name extracted");
    }

    // Extract course name from markdown or HTML
    // Look for course patterns in markdown first
    const coursePatterns = [
      /Working with\s+([A-Za-z0-9\s]+?)(?:\n|$|in|and)/i,
      /Course:\s*([^\n]+)/i,
      /Project:\s*([^\n]+)/i,
    ];

    for (const pattern of coursePatterns) {
      const match = markdown.match(pattern);
      if (match && match[1]) {
        course = match[1].trim();
        console.log("Extracted course from markdown:", course);
        break;
      }
    }

    // Try HTML patterns for course if markdown didn't work
    if (!course && html) {
      const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
      if (h2Match) {
        const h2Content = h2Match[1].trim();
        if (!h2Content.toLowerCase().includes("completed by") &&
            !h2Content.toLowerCase().includes("coursera") &&
            h2Content.length > 3) {
          course = h2Content;
          console.log("Extracted course from h2:", course);
        }
      }
    }

    console.log("Final Firecrawl extraction result:", { name, course });
    return { name: normalizeText(name), course: normalizeText(course) };
  } catch (error) {
    console.error("Error scraping Coursera with Firecrawl:", error);
    // Fallback to basic scraping
    return await scrapeCourseraBasic(url);
  }
}

// Fallback basic scraping when Firecrawl is not available
async function scrapeCourseraBasic(
  url: string,
): Promise<{ name: string; course: string }> {
  try {
    console.log("Fallback: Scraping Coursera URL with basic fetch:", url);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.log("Basic fetch response not OK:", response.status);
      return { name: "", course: "" };
    }

    const html = await response.text();
    console.log("Basic fetch HTML length:", html.length);

    let name = "";
    let course = "";

    // STRICT EXTRACTION: Only extract student name from "Completed by" pattern
    const classPatterns = [
      /class="[^"]*cds-119[^"]*cds-Typography-base[^"]*css-h1jogs[^"]*cds-121[^"]*"[^>]*>([^<]+)</gi,
    ];

    for (const pattern of classPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const content = match[1]?.trim();
        if (content && content.toLowerCase().includes("completed by")) {
          const nameMatch = content.match(/completed by\s+(.+)/i);
          if (nameMatch && nameMatch[1]) {
            const extractedName = nameMatch[1].trim();
            if (extractedName.toLowerCase() !== "coursera" && 
                extractedName.length > 1 &&
                !extractedName.toLowerCase().includes("coursera")) {
              name = extractedName;
              console.log("Extracted name from basic HTML class:", name);
              break;
            }
          }
        }
      }
      if (name) break;
    }

    // General patterns
    if (!name) {
      const patterns = [
        /Completed by\s*<strong[^>]*>([^<]+)<\/strong>/gi,
        /Completed by\s+([A-Za-z][A-Za-z\s]{2,50})(?:<|,|\.|\||&|$)/gi,
      ];
      
      for (const pattern of patterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          const extractedName = match[1]?.trim();
          if (extractedName && 
              extractedName.toLowerCase() !== "coursera" &&
              !extractedName.toLowerCase().includes("coursera") &&
              extractedName.length > 1 &&
              extractedName.length < 60) {
            name = extractedName;
            console.log("Extracted name from basic HTML pattern:", name);
            break;
          }
        }
        if (name) break;
      }
    }

    if (!name) {
      console.log("WARNING: Could not find 'Completed by' pattern in basic fetch - no student name extracted");
    }

    // Extract course from h2 or similar
    const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
    if (h2Match) {
      const h2Content = h2Match[1].trim();
      if (!h2Content.toLowerCase().includes("completed by") &&
          !h2Content.toLowerCase().includes("coursera") &&
          h2Content.length > 3) {
        course = h2Content;
        console.log("Extracted course from h2:", course);
      }
    }

    console.log("Final basic extraction result:", { name, course });
    return { name: normalizeText(name), course: normalizeText(course) };
  } catch (error) {
    console.error("Error in basic Coursera scraping:", error);
    return { name: "", course: "" };
  }
}

async function scrapeLinkedInPost(
  url: string,
): Promise<{ profileName: string; postText: string }> {
  try {
    console.log("Scraping LinkedIn URL:", url);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.log("LinkedIn response not OK:", response.status);
      return { profileName: "", postText: "" };
    }

    const html = await response.text();
    console.log("LinkedIn HTML length:", html.length);

    let profileName = "";
    let postText = "";

    // Extract from title (usually contains poster name)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      const titleText = titleMatch[1];
      // LinkedIn titles often have format "Name on LinkedIn: Post..."
      const nameMatch = titleText.match(/^([^|]+?) (?:on|posted|shared)/i);
      if (nameMatch) {
        profileName = nameMatch[1].trim();
      } else {
        profileName = titleText.split("|")[0]?.trim() || "";
      }
    }

    // Try to get post content from meta description
    const descMatch = html.match(
      /<meta[^>]*name="description"[^>]*content="([^"]+)"/i,
    );
    if (descMatch) {
      postText = descMatch[1];
    }

    // Also try og:description
    const ogDescMatch = html.match(
      /<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i,
    );
    if (ogDescMatch) {
      postText = postText || ogDescMatch[1];
    }

    // Extract any visible text as fallback
    const bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!postText && bodyText.length > 0) {
      postText = bodyText.substring(0, 2000);
    }

    console.log("Extracted LinkedIn data:", {
      profileName: profileName.substring(0, 50),
      postTextLength: postText.length,
    });

    return {
      profileName: normalizeText(profileName),
      postText: normalizeText(postText),
    };
  } catch (error) {
    console.error("Error scraping LinkedIn:", error);
    return { profileName: "", postText: "" };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { studentName, courseraLink, linkedinLink } = await req.json();

    console.log("Processing verification for:", studentName);
    console.log("Coursera Link:", courseraLink);
    console.log("LinkedIn Link:", linkedinLink);

    const excelName = normalizeText(studentName);

    // Scrape both URLs concurrently
    const [courseraData, linkedinData] = await Promise.all([
      scrapeCourseraCertificate(courseraLink),
      scrapeLinkedInPost(linkedinLink),
    ]);

    // Step 1: Match Excel name with Coursera student name
    const excelMatchesCoursera = namesMatch(excelName, courseraData.name);
    console.log("Excel vs Coursera match:", {
      excelName,
      courseraName: courseraData.name,
      match: excelMatchesCoursera,
    });

    // Step 2: Extract name from LinkedIn URL and match with Excel name
    const linkedinUrlName = extractNameFromLinkedInUrl(linkedinLink);
    const excelMatchesLinkedinUrl = namesMatch(excelName, linkedinUrlName, 70);
    console.log("Excel vs LinkedIn URL match:", {
      excelName,
      linkedinUrlName,
      match: excelMatchesLinkedinUrl,
    });

    // Step 3: Cross-verify Coursera name with LinkedIn URL name
    const courseraMatchesLinkedinUrl = namesMatch(
      courseraData.name,
      linkedinUrlName,
      70,
    );
    console.log("Coursera vs LinkedIn URL match:", {
      courseraName: courseraData.name,
      linkedinUrlName,
      match: courseraMatchesLinkedinUrl,
    });

    // Final Student Match Decision - All three must match
    const studentMatch =
      excelMatchesCoursera &&
      excelMatchesLinkedinUrl &&
      courseraMatchesLinkedinUrl;

    // Build reason for student match failure
    let studentMatchReason = "";
    if (!studentMatch) {
      const reasons: string[] = [];
      if (!courseraData.name) {
        reasons.push("Coursera certificate name not found (no 'Completed by' pattern detected)");
      } else if (!excelMatchesCoursera) {
        reasons.push(
          `Coursera name "${courseraData.name}" doesn't match Excel name "${excelName}"`,
        );
      }
      if (!linkedinUrlName) {
        reasons.push("Could not extract username from LinkedIn URL");
      } else if (!excelMatchesLinkedinUrl) {
        reasons.push(
          `LinkedIn URL name "${linkedinUrlName}" doesn't match Excel name "${excelName}"`,
        );
      }
      if (courseraData.name && linkedinUrlName && !courseraMatchesLinkedinUrl) {
        reasons.push(
          `Coursera name "${courseraData.name}" doesn't match LinkedIn URL name "${linkedinUrlName}"`,
        );
      }
      studentMatchReason = reasons.join("; ");
    }

    // Course/Project Match
    const courseMatch = projectMatch(
      courseraData.course,
      linkedinData.postText,
    );

    // Build reason for course match failure
    let courseMatchReason = "";
    if (!courseMatch) {
      const reasons: string[] = [];
      if (!courseraData.course) {
        reasons.push("Could not extract course/project name from Coursera");
      } else if (!linkedinData.postText) {
        reasons.push("Could not extract text from LinkedIn post");
      } else {
        reasons.push(
          `Course "${courseraData.course}" not found in LinkedIn post`,
        );
      }
      courseMatchReason = reasons.join("; ");
    }

    console.log("Final verification results:", {
      excelName,
      courseraName: courseraData.name,
      linkedinUrlName,
      excelMatchesCoursera,
      excelMatchesLinkedinUrl,
      courseraMatchesLinkedinUrl,
      studentMatch,
      courseMatch,
      studentMatchReason,
      courseMatchReason,
    });

    return new Response(
      JSON.stringify({
        studentMatchAuto: studentMatch ? "Yes" : "No",
        courseMatchAuto: courseMatch ? "Yes" : "No",
        studentMatchReason,
        courseMatchReason,
        scrapedCourseraName: courseraData.name,
        scrapedCourseraProject: courseraData.course,
        scrapedLinkedinName: linkedinData.profileName,
        scrapedLinkedinText: linkedinData.postText.substring(0, 200),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Verification error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Verification failed",
        studentMatchAuto: "No",
        courseMatchAuto: "No",
        scrapedCourseraName: "",
        scrapedCourseraProject: "",
        scrapedLinkedinName: "",
        scrapedLinkedinText: "",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Return 200 even on error to not break batch processing
      },
    );
  }
});
