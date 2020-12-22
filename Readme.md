Video platform - Vupload  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)  
_Backend service_

VShare is a platform that enables users to boardcast their video around the world
The repo is used for api service

**Disclaimer: It is still in an early stage of development. For personal purposes only. It takes no responsibility on working in commercial purpose.**

## Table of Contents
- [Table of Contents](#table-of-contents)
- [Feature](#feature)
- [Prerequisite](#prerequisite)
- [Service architecture](#service-architecture)
- [Building and test](#building-and-test)
- [Run](#run)
- [Available APIs](#available-apis)
- [Author](#author)
- [License](#license)

Feature
-----
*done*
* User sign in/out
* User sign up
* User library
* Watch video
* Video likes/views count
* Video comment
* Video search
* Video subscription
* Video upload
* Public/Private video
*ongoing*
* User follow/unfollow
* Video search autocompletion
* Video suggestion

Prerequisite
-----
* Nodejs >= v12
* Yarn
* MongoDB >= v3.6
* RabbitMQ >= v3.8
* Redis >= v5.0

Service architecture
-----
 

Building and test
-----

* Build
  
```bash
$ yarn install --frozen-lockfile
```

Run
-----

* For development

```bash
$ yarn start
```

Available APIs
-----

Author
-----
Jeremy Li

License
-----
MIT License
