package logos

import (
	"sort"
	"strings"
)

type SearchResult struct {
	Note        Note    `json:"note"`
	Score       float64 `json:"score"`
	MatchSource string  `json:"matchSource"`
}

func rankNotesForQuery(notes []Note, query string, limit int) []SearchResult {
	normalizedQuery := strings.TrimSpace(query)
	if normalizedQuery == "" {
		return []SearchResult{}
	}

	if limit <= 0 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}

	results := make([]SearchResult, 0, len(notes))
	for _, note := range notes {
		titleScore, titleMatch := fuzzyScore(note.Title, normalizedQuery)
		contentScore, contentMatch := fuzzyScore(note.Content, normalizedQuery)

		if !titleMatch && !contentMatch {
			continue
		}

		totalScore := (titleScore * 2.0) + contentScore
		source := "both"
		if titleMatch && !contentMatch {
			source = "title"
		}
		if contentMatch && !titleMatch {
			source = "content"
		}

		results = append(results, SearchResult{
			Note:        note,
			Score:       totalScore,
			MatchSource: source,
		})
	}

	sortSearchResults(results)

	if len(results) > limit {
		results = results[:limit]
	}

	return results
}

func sortSearchResults(results []SearchResult) {
	sort.Slice(results, func(i, j int) bool {
		if results[i].Score == results[j].Score {
			return results[i].Note.ID < results[j].Note.ID
		}
		return results[i].Score > results[j].Score
	})
}

func fuzzyScore(text, query string) (float64, bool) {
	normalizedText := strings.ToLower(strings.TrimSpace(text))
	normalizedQuery := strings.ToLower(strings.TrimSpace(query))
	if normalizedText == "" || normalizedQuery == "" {
		return 0, false
	}

	if strings.Contains(normalizedText, normalizedQuery) {
		score := 100.0
		if strings.HasPrefix(normalizedText, normalizedQuery) {
			score += 20
		}
		return score, true
	}

	textRunes := []rune(normalizedText)
	queryRunes := []rune(normalizedQuery)
	q := 0
	lastIdx := -1
	gaps := 0

	for i := 0; i < len(textRunes) && q < len(queryRunes); i++ {
		if textRunes[i] != queryRunes[q] {
			continue
		}
		if lastIdx >= 0 {
			gaps += i - lastIdx - 1
		}
		lastIdx = i
		q++
	}

	if q != len(queryRunes) {
		return 0, false
	}

	score := 70.0 - float64(gaps)
	if score < 1 {
		score = 1
	}
	return score, true
}
