// REST review comments omit thread IDs and resolution status; fetch them through GraphQL.
export const REVIEW_THREADS_QUERY = `
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          line
          startLine
          originalLine
          originalStartLine
          comments(first: 100) {
            nodes {
              id
              databaseId
              author { __typename login avatarUrl(size: 48) }
              body
              createdAt
              lastEditedAt
              viewerCanUpdate
              viewerCanDelete
              url
              path
              reactionGroups {
                content
                viewerHasReacted
                reactors(first: 3) {
                  totalCount
                  nodes { ... on Actor { login } }
                }
              }
            }
          }
        }
      }
      comments(first: 100) {
        nodes {
          id
          databaseId
          author { __typename login avatarUrl(size: 48) }
          body
          createdAt
          lastEditedAt
          viewerCanUpdate
          url
          reactionGroups {
            content
            viewerHasReacted
            reactors(first: 3) {
              totalCount
              nodes { ... on Actor { login } }
            }
          }
        }
      }
      reviews(first: 100) {
        nodes {
          id
          databaseId
          state
          author { __typename login avatarUrl(size: 48) }
          body
          createdAt
          lastEditedAt
          viewerCanUpdate
          url
          reactionGroups {
            content
            viewerHasReacted
            reactors(first: 3) {
              totalCount
              nodes { ... on Actor { login } }
            }
          }
        }
      }
    }
  }
}`
