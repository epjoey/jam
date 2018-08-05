import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';


class Player extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isPlaying: false,
    };

    this.playOrPause = this.playOrPause.bind(this);
  }

  playOrPause(evt) {
    let currentlyPlaying = this.state.isPlaying;
    console.log('currently playing? ' + currentlyPlaying)

    const includedTracks = this.props.tracks.filter(track => {
      return track.isIncluded && track.src;
    })
    let shouldPlay = !currentlyPlaying && includedTracks.length > 0;

    if(shouldPlay){
      includedTracks.forEach(track => {
        track.audio.onended = () => {
          const allEnded = includedTracks.every(track => {
            return track.audio.ended;
          })
          if(allEnded){
            console.log(includedTracks.length + ' tracks ended')
            this.setState({isPlaying: false});
          }
        }
      });
    }

    console.log((shouldPlay ? 'playing ' : 'pausing ') + includedTracks.length + ' tracks')

    const method = shouldPlay ? 'play' : 'pause';
    includedTracks.forEach(track => {
      track.audio[method]();
    });

    this.setState({isPlaying: shouldPlay});
  }

  render() {
    const label = this.state.isPlaying ? 'Pause' : 'Play';
    return (
      <img src={logo} className={"App-logo" + (this.state.isPlaying ? ' spinning' : '')}
        alt={label}
        onClick={this.playOrPause}
      />
      /* <div className="player">
        <button onClick={() => this.playOrPause()}>{label}</button>
      </div> */
    );
  }
}

class Recorder extends Component {
  render() {
    const label = this.props.isRecording ? 'Stop Recording' : 'Record';
    return (
      <button onClick={() => this.props.onClick()}>{label}</button>
    );
  }
}

class Track extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isIncluded: !!props.track.isIncluded
    };

    this.handleChange = this.handleChange.bind(this);
  }
  
  handleChange(event) {
    const track = this.props.track;
    track.isIncluded = !track.isIncluded;
    this.setState({isIncluded: track.isIncluded});
    fetch('http://localhost:3000/api/track/' + track.id, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({isIncluded: track.isIncluded})
    })
    .catch(error => console.error('Error:', error))
    .then(response => {
      console.log('Changed track:', response)
    });
  }

  delete() {
    this.props.deleteTrack(this.props.track);
  }

  rename() {
    this.props.track.name = window.prompt('Enter a name for your track', this.props.track.name);
    this.forceUpdate();
  }

  render() {
    return (
      <li className='track'>
        {this.props.track.name}
        <input type='checkbox'
          name="isIncluded"
          value={this.state.isIncluded}
          checked={this.state.isIncluded}
          onChange={this.handleChange}
        />
        <button onClick={() => this.delete()}>delete</button>
        <button onClick={() => this.rename()}>rename</button>
      </li>
    );
  }
}

class TrackList extends Component {
  render() {
    const tracks = this.props.tracks.slice().reverse();
    const trackElements = tracks.map(track => {
      return (
        <Track key={track.id}
          track={track}
          deleteTrack={(track) => this.props.deleteTrack(track)}
        />
      );
    });
    return (
      <ol>{trackElements}</ol>
    );
  }
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isRecording: false,
      isLoaded: false,
      jam: null,
      tracks: [],
    };

    this.chunks = [];
  }

  componentDidMount() {
    fetch('http://localhost:3000/api/jam/last')
      .then(res => res.json())
      .then(
        (result) => {
          const jam = result.jam;
          const tracks = jam.tracks;
          tracks.forEach(track => {
            track.audio = new Audio(track.src);
          })
          this.setState({
            isLoaded: true,
            jam: jam,
            tracks: tracks,
          });
        },
        // Note: it's important to handle errors here
        // instead of a catch() block so that we don't swallow
        // exceptions from actual bugs in components.
        (error) => {
          this.setState({
            isLoaded: true,
            error
          });
        }
      )
  }

  onStop(evt) {
    console.log("recorder on stop");

    const blob = new Blob(this.chunks, { 'type' : 'audio/ogg; codecs=opus' });
    const audioURL = URL.createObjectURL(blob);

    const trackName = window.prompt('Enter a name for your track', 'untitled');
    if(!trackName){
      return
    }

    const track = {
      isIncluded: true,
      name: trackName,
      jamId: this.state.jam.id,
    };

    this.chunks = [];

    // Upload track to the server.
    let formData = new FormData();
    formData.append('blob', blob);
    formData.append('jamId', track.jamId);
    formData.append('name', track.name);
    formData.append('isIncluded', track.isIncluded);
    fetch('http://localhost:3000/api/tracks', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .catch(error => console.error('Error:', error))
    .then(response => {
      console.log('Success:', response)
      const tracks = this.state.tracks;
      const track = response.track;
      track.audio = new Audio(track.src);
      this.setState({
        tracks: tracks.concat(track),
      });
    });
  }

  onDataAvailable(evt) {
    console.log("on data available");
    this.chunks.push(evt.data)
  }

  onError(evt) {
    console.log('error', evt)
    alert('error:' + evt) // for debugging purposes
  }

  stopRecording() {
    this.mediaRecorder.stop();
    this.setState({isRecording: false});
    console.log("recorder stopped");
  }

  startRecording() {
    // This is the case on ios/chrome, when clicking links from within ios/slack (sometimes), etc.
    if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Missing support for navigator.mediaDevices.getUserMedia') // temp: helps when testing for strange issues on ios/safari
      return
    }
    
    navigator.mediaDevices.getUserMedia({audio: true}).then(stream => {
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.addEventListener('dataavailable', (evt) => this.onDataAvailable(evt))
      this.mediaRecorder.addEventListener('stop', (evt) => this.onStop(evt))
      this.mediaRecorder.addEventListener('error', (evt) => this.onError(evt))

      this.mediaRecorder.start();
      this.setState({isRecording: true});
      console.log("recorder started");      
    })
    .catch(error => {
      alert('Error with getUserMedia: ' + error.message) // temp: helps when testing for strange issues on ios/safari
      console.log(error)
    });
  }

  startOrStopRecording() {
    if(this.state.isRecording){
      this.stopRecording();
    }
    else {
      this.startRecording();
    }
  }

  deleteTrack(track){
    fetch('http://localhost:3000/api/track/' + track.id, {
      method: 'DELETE',
    })
    .catch(error => console.error('Error:', error))
    .then(response => {
      console.log('Deleted track:', response)
      const tracks = this.state.tracks.filter(t => {
        return t.id !== track.id;
      })
      this.setState({tracks: tracks})
    });
  }

  render() {
    const { error, isLoaded, jam } = this.state;
    if(error){
      return <div>Error: {error.message}</div>;
    } else if (!isLoaded) {
      return <div>Loading...</div>;
    }
    return (
      <div className="App">
        <header className="App-header">
          <Player className="player" tracks={this.state.tracks} />
        </header>
        

        <Recorder isRecording={this.state.isRecording}
          onClick={() => this.startOrStopRecording() }
        />

        <TrackList tracks={this.state.tracks}
          deleteTrack={(track) => this.deleteTrack(track)}
        />
      </div>
    );
  }
}

export default App;
