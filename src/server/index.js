const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const expressFileUpload = require('express-fileupload');
const app = express();

app.use(expressFileUpload());
app.use(express.json());

let db = new sqlite3.Database('./src/server/main.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the main.db SQlite database.');
});

const Jam = row => {
  return {
    id: row.id,
    name: row.name,
  }
}

const Track = row => {
  return {
    id: row.id,
    jamId: row.jam_id,
    isIncluded: row.is_included,
    src: row.src,
    name: row.name,
  }
}

// route to trigger the capture
app.get('/api/jam/:id', function (req, res) {
  const id = req.params.id;
  let sql, params;
  if(id === 'last'){
    sql = 'SELECT * FROM jams ORDER BY id DESC LIMIT 1;';
    params = {};
  } else {
    sql = 'SELECT * FROM jams WHERE id = $id';
    params = {$id: id};
  }
  db.get(sql, params, (err, row) => {
    if(err){
      return res.status(500).send(err);
    }    
    jam = Jam(row)
    db.all('SELECT * FROM tracks WHERE jam_id = $jamId', {$jamId: jam.id}, (err, rows) => {
      jam.tracks = rows.map(Track);
      res.send({ jam: jam });
    });
  });
});

app.delete('/api/track/:id', (req, res) => {
  db.run("DELETE FROM tracks WHERE id = ?", req.params.id, err => {
    if(err){
      console.log(err);
      return res.status(500).send(err);
    }
    res.send({ success: true });
  })
})

app.put('/api/track/:id', (req, res) => {
  console.log(req.body)
  const isIncluded = req.body.isIncluded;
  db.run("UPDATE tracks SET is_included = ? WHERE id = ?", isIncluded, req.params.id, (err) => {
    if(err){
      console.log(err);
      return res.status(500).send(err);
    }
    res.send({ success: true });
  })
})

app.post('/api/tracks', (req, res) => {
  console.log(req.files.blob);
  console.log(req.body);
  name = req.body.name;
  const filename = 'track-' + name + '-' + Date.now() + '.wav';

  req.files.blob.mv('public/' + filename, function(err) {
    if(err){
      console.log(err);
      return res.status(500).send(err);
    }
    const src = 'http://localhost:3000/public/' + filename;
    db.run("INSERT INTO tracks (name, jam_id, src, is_included) VALUES ($name, $jamId, $src, $isIncluded)", {
      $src: src,
      $name: name,
      $jamId: req.body.jamId,
      $isIncluded: req.body.isIncluded === 'true',
    }, function(err, row){
      if(err){
        return console.error(err.message);
        return res.status(500).send(err);
      }
      if(this.lastID){
        db.get("SELECT * FROM tracks WHERE id = ?;", this.lastID, function(err, row){
          res.send({ success: true, track: Track(row) });
        });
      }
    })
  });
});

app.get('/api/jams', (req, res) => {
  db.all("SELECT * FROM jams", {}, (err, rows) => {
    console.log('err:', err);
    console.log(rows);
    res.send({ jams: rows });
  })
});


function closeDb() {
  console.log("closeDb");
  // close the database connection
  db.close((err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log('Close the database connection.');
  });
}

app.use(express.static('dist'));
app.listen(8080, () => console.log('Listening on port 8080!'));