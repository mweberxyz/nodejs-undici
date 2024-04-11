'use strict'

// Called from .github/workflows

const generateReleaseNotes = async ({ github, owner, repo, versionTag, defaultBranch }) => {
  const { data: releases } = await github.rest.repos.listReleases({
    owner,
    repo
  })

  const { data: { body } } = await github.rest.repos.generateReleaseNotes({
    owner,
    repo,
    tag_name: versionTag,
    target_commitish: defaultBranch,
    previous_tag_name: releases[0]?.tag_name
  })

  const bodyWithoutReleasePr = body.split('\n')
    .filter((line) => !line.includes('[Release] v'))
    .join('\n')

  return bodyWithoutReleasePr
}

const generatePr = async ({ github, context, defaultBranch, versionTag }) => {
  const { owner, repo } = context.repo
  const releaseNotes = await generateReleaseNotes({ github, owner, repo, versionTag, defaultBranch })

  await github.rest.pulls.create({
    owner,
    repo,
    head: `release/${versionTag}`,
    base: defaultBranch,
    title: `[Release] ${versionTag}`,
    body: releaseNotes
  })
}

const release = async ({ github, context, defaultBranch, versionTag }) => {
  const { owner, repo } = context.repo
  const releaseNotes = await generateReleaseNotes({ github, owner, repo, versionTag, defaultBranch })

  await github.rest.repos.createRelease({
    owner,
    repo,
    tag_name: versionTag,
    target_commitish: defaultBranch,
    name: versionTag,
    body: releaseNotes,
    draft: false,
    prerelease: false,
    generate_release_notes: false
  })
}

module.exports = {
  generatePr,
  release
}
