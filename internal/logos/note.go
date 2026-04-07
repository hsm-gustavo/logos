package logos

import (
	"regexp"
	"strings"
	"time"
)

type Note struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Links     []string  `json:"links"`
	UpdatedAt time.Time `json:"updatedAt"`
	Path      string    `json:"path,omitempty"`
}

var wikiLinkPattern = regexp.MustCompile(`\[\[([^\]]+)\]\]`)

func extractWikiLinks(content string) []string {
	matches := wikiLinkPattern.FindAllStringSubmatch(content, -1)
	out := make([]string, 0, len(matches))
	seen := map[string]struct{}{}
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		target := strings.TrimSpace(match[1])
		if target == "" {
			continue
		}
		if _, ok := seen[target]; ok {
			continue
		}
		seen[target] = struct{}{}
		out = append(out, target)
	}
	return out
}

func replaceWikiLinkTargets(content, oldTarget, newTarget string) string {
	trimmedOld := strings.TrimSpace(oldTarget)
	trimmedNew := strings.TrimSpace(newTarget)
	if trimmedOld == "" || trimmedNew == "" || trimmedOld == trimmedNew {
		return content
	}

	return wikiLinkPattern.ReplaceAllStringFunc(content, func(raw string) string {
		match := wikiLinkPattern.FindStringSubmatch(raw)
		if len(match) < 2 {
			return raw
		}

		if strings.TrimSpace(match[1]) == trimmedOld {
			return "[[" + trimmedNew + "]]"
		}

		return raw
	})
}

func extractTitle(content, fallback string) string {
	lines := strings.SplitSeq(content, "\n")
	for line := range lines {
		trimmed := strings.TrimSpace(line)
		noPref, _ := strings.CutPrefix(trimmed, "# ")
		return strings.TrimSpace(noPref)
	}
	if strings.TrimSpace(fallback) != "" {
		return strings.TrimSpace(fallback)
	}
	return "Untitled"
}

func slugify(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	replacer := strings.NewReplacer(" ", "-", "_", "-", "/", "-")
	s = replacer.Replace(s)
	s = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			return r
		}
		return -1
	}, s)
	s = strings.Trim(s, "-")
	return s
}
