'use strict'

// Called from .github/workflows

const versionTagToBranch = (versionTag) => {
  if (versionTag.startsWith('v6.')) {
    return 'main'
  }
  if (versionTag.startsWith('v5.')) {
    return 'v5.x'
  }
  throw new Error(`No mapping of versionTag (${versionTag}) to branch defined`)
}

const versionTagToCommitish = (versionTag) => `heads/${versionTagToBranch(versionTag)}`

const getLatestRelease = async ({ github, owner, repo, versionTag }) => {
  const majorVersionPrefix = versionTag.split('.')[0] + '.'

  const { data } = await github.rest.repos.listReleases({
    owner,
    repo
  })

  const latestRelease = data.find((r) => r.tag_name.startsWith(majorVersionPrefix))

  if (!latestRelease) {
    throw new Error(`Could not find latest release of ${majorVersionPrefix}x`)
  }

  return latestRelease
}

const generateReleaseNotes = async ({ github, owner, repo, versionTag }) => {
  const previousRelease = await getLatestRelease({ github, owner, repo, versionTag })

  const { data: { body } } = await github.rest.repos.generateReleaseNotes({
    owner,
    repo,
    tag_name: versionTag,
    target_commitish: versionTagToCommitish(versionTag),
    previous_tag_name: previousRelease.tag_name
  })

  const bodyWithoutReleasePr = body.split('\n')
    .filter((line) => !line.includes('[Release] v'))
    .join('\n')

  return bodyWithoutReleasePr
}

const generatePr = async ({ github, context, versionTag }) => {
  const { owner, repo } = context.repo
  const releaseNotes = await generateReleaseNotes({ github, owner, repo, versionTag })

  await github.rest.pulls.create({
    owner,
    repo,
    head: `release/${versionTag}`,
    base: versionTagToBranch(versionTag),
    title: `[Release] ${versionTag}`,
    body: releaseNotes
  })
}

const release = async ({ github, context, versionTag }) => {
  const { owner, repo } = context.repo
  const releaseNotes = await generateReleaseNotes({ github, owner, repo, versionTag })

  await github.rest.repos.createRelease({
    owner,
    repo,
    tag_name: versionTag,
    target_commitish: versionTagToCommitish(versionTag),
    name: versionTag,
    body: releaseNotes,
    draft: false,
    prerelease: false,
    generate_release_notes: false
  })

  try {
    await github.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/release/${versionTag}`
    })
  } catch (err) {
    console.log("Couldn't delete release PR ref")
    console.log(err)
  }
}

const previousReleaseTag = async ({ github, context, versionTag }) => {
  const { owner, repo } = context.repo
  const previousRelease = await getLatestRelease({ github, owner, repo, versionTag })
  return previousRelease.tag_name
}

module.exports = {
  generatePr,
  release,
  previousReleaseTag
}
