Waggle.js
=========

An experiment to distribute the bandwidth among video viewers.

First visitors download chunks from the server and announce which
chunks they have to the swarm. Once there is *enough* visitors,
subsequent ones will request chunks from the swarm and not from the
server, thus reducing bandwidth cost for the server.

Getting started
---------------

Clone the project:

    $ git clone https://github.com/tOkeshu/waggle.js.git
    $ cd waggle.js
    $ npm install # will also download an example.webm file

Start the server:

    $ ./bin/waggle

Then open a browser to [http://localhost:7665](http://localhost:7665)

What about the name
-------------------

The term "waggle" is a reference to the
[waggle dance](https://en.wikipedia.org/wiki/Waggle_dance) performed
by honey bees.

License
-------

Waggle.js is released under the terms of the
[GNU Affero General Public License v3](http://www.gnu.org/licenses/agpl-3.0.html)
or later.

