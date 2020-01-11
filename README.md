# Postmgn

This is a tool that export and import postman collections and environments

## How to install
```
$ npm install -g postmgn
```

## How to use

#### For the first time

First, Go to https://postman.co to generate your API Key

Then enter `postmgn` in the terminal and follow the instructions
```
$ postmgn
? What is your Postman API Key?
? Please choose some collections you want to version control: (Press <space> to select, <a> to toggle all, <i> to invert selection)
❯◯ Collection 1
 ◯ Collection 2
 ◯ Collection 3

? Please choose some environments you want to version control: (Press <space> to select, <a> to toggle all, <i> to invert selection)
❯◯ Environment 1
 ◯ Environment 2
 ◯ Environment 3
 
? Where do you want to save exported collections? [collections] 
? Where do you want to save exported environments? [environments]
Done.
```

It will create the following file structures
```
collections/
environments/
postmgn.config
postmgn.private.config
```

You may also use the environment `POSTMAN_API_KEY` to better manage your api key,
`export POSTMAN_API_KEY=xxxxxxxxx` in your terminal startup script. e.g. `~/.bashrc` for macOS

Example project: https://github.com/smallcampus/postmgn-example

#### The one who update postman collection and share to others
```
$ postmgn export
$ git commit
$ git push
```

#### The one who receive postman collection update
```
$ git pull

$ postmgn import
```

Your postman will update immediately if you are online.

### Troubleshot

 + Add more collections and environments after init 

For now you could manually delete the `postmgn.config` file and run `postmgn` again.

 + API expired or invalid
 
 The api key is saved in postmgn.private.config, you can manually edit that.
 
 + Collection not updated?
 
 This tool work on both your personal workspace and team workspace. I suggest you to 
 copy the collection into your own workspace before using this tool, because team 
 workspace has a lot of limitation.
 
 + the collection ID keeps changing when my teammates export
 
 Future release will fix that