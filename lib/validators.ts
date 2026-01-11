export function validateUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter a URL to send.";
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "URL must start with http or https.";
    }
    return null;
  } catch {
    return "Provide a valid URL.";
  }
}

const kindleDomains = ["kindle.com", "free.kindle.com"];

export function validateKindleEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0) {
    return "Provide a valid Kindle email.";
  }

  const domain = trimmed.slice(atIndex + 1).toLowerCase();
  if (!kindleDomains.includes(domain)) {
    return "Kindle email must end in kindle.com or free.kindle.com.";
  }

  return null;
}
