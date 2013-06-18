var chai = require('chai')
chai.should();
var expect = chai.expect;

var sinon = require('sinon');

var Bridge = require('../../lib/bridge');

describe('Bridge', function () {
  /**
   * NB these tests don't test whether the logger is invoked with
   * the right strings: they just test that the sdb wrapper and
   * file lister are invoked correctly, and that the responses are
   * parsed properly, returning the correct values to the callback
   */
  var logger = {
    write: function () {},
    ok: function () {},
    error: function () {},
    warn: function () {}
  };

  var sdbWrapper = {
    execute: function () {},
    shell: function () {},
    push: function () {},
    forward: function () {},
    root: function () {}
  };

  var fileLister = {
    list: function () {}
  };

  var bridge = Bridge.init({
    logger: logger,
    sdbWrapper: sdbWrapper,
    fileLister: fileLister
  });

  var mockSdbWrapper;
  var mockBridge;
  beforeEach(function () {
    mockSdbWrapper = sinon.mock(sdbWrapper);
    mockBridge = sinon.mock(bridge);
  });

  afterEach(function () {
    mockSdbWrapper.restore();
    mockBridge.restore();
  });

  it('should require logger property on creation', function () {
    var testConstruct = function () {
      Bridge.init({})
    };

    var expected = 'Bridge must be initialised with a logger instance';

    expect(testConstruct).to.throw(expected);
  });

  it('should require sdbWrapper property on creation', function () {
    var testConstruct = function () {
      Bridge.init({
        logger: {}
      })
    };

    var expected = 'Bridge must be initialised with an sdbWrapper instance';

    expect(testConstruct).to.throw(expected);
  });

  it('should require sdbWrapper property on creation', function () {
    var testConstruct = function () {
      Bridge.init({
        logger: {},
        sdbWrapper: {}
      })
    };

    var expected = 'Bridge must be initialised with the fileLister instance';

    expect(testConstruct).to.throw(expected);
  });

  describe('fileExists()', function () {
    var remotePath = '/tmp/foo.txt';
    var cb = sinon.spy();

    it('should callback with true if file exists', function () {
      mockSdbWrapper.expects('shell')
                    .withArgs('stat ' + remotePath, sinon.match.instanceOf(Function))
                    .callsArgWith(1, null, '', '')
                    .once();

      bridge.fileExists(remotePath, cb);

      cb.calledWith(null, true).should.be.true;
      mockSdbWrapper.verify();
    });

    it('should callback with false if file does not exist', function () {
      mockSdbWrapper.expects('shell')
                    .withArgs('stat ' + remotePath, sinon.match.instanceOf(Function))
                    .callsArgWith(1, null, 'No such file or directory', '')
                    .once();

      bridge.fileExists(remotePath, cb);

      cb.calledWith(null, false).should.be.true;
      mockSdbWrapper.verify();
    });

    it('should callback with error if error occurs when invoking sdb', function () {
      mockSdbWrapper.expects('shell')
                    .withArgs('stat ' + remotePath, sinon.match.instanceOf(Function))
                    .callsArgWith(1, new Error())
                    .once();

      bridge.fileExists(remotePath, cb);

      cb.calledWith(sinon.match(Error)).should.be.true;
      mockSdbWrapper.verify();
    });
  });

  describe('chmod()', function () {
    var remotePath = '/tmp/somescript.sh';
    var chmodStr = '+x';
    var cb = sinon.spy();

    it('should callback with no error if chmod worked', function () {
      mockSdbWrapper.expects('shell')
                    .withArgs(
                      'chmod ' + chmodStr + ' ' + remotePath,
                      sinon.match.instanceOf(Function)
                    )
                    .callsArgWith(1, null, '', '')
                    .once();

      bridge.chmod(remotePath, chmodStr, cb);

      cb.calledOnce.should.be.true;
      mockSdbWrapper.verify();
    });

    it('should callback with no error if chmod failed', function () {
      mockSdbWrapper.expects('shell')
                    .withArgs(
                      'chmod ' + chmodStr + ' ' + remotePath,
                      sinon.match.instanceOf(Function)
                    )
                    .callsArgWith(1, new Error())
                    .once();

      bridge.chmod(remotePath, chmodStr, cb);

      cb.calledWith(sinon.match(Error)).should.be.true;
      mockSdbWrapper.verify();
    });
  });

  describe('listRemoteFiles()', function () {
    it('should callback with the file path passed in if it is a string', function () {
      var cb = sinon.spy()
      var filename = '/tmp/package.wgt';

      bridge.listRemoteFiles(filename, cb);

      cb.calledWith(null, [filename]).should.be.true
    });

    it('should callback with the file paths passed in if passed an array', function () {
      var cb = sinon.spy()
      var filenames = ['/tmp/package.wgt', '/tmp/package2.wgt'];

      bridge.listRemoteFiles(filenames, cb);

      cb.calledWith(null, filenames).should.be.true
    });

    it('should callback with error if ls fails on the sdb shell', function () {
      var cb = sinon.spy()
      var filespec = {pattern: '/tmp/*.wgt'};

      mockSdbWrapper.expects('shell')
                    .withArgs(
                      'ls -1 -c ' + filespec.pattern,
                      sinon.match.instanceOf(Function)
                    )
                    .callsArgWith(1, new Error())
                    .once();

      bridge.listRemoteFiles(filespec, cb);

      cb.calledWith(sinon.match(Error)).should.be.true;
      mockSdbWrapper.verify();
    });

    it('should callback with matching files if ls successful', function () {
      var cb = sinon.spy();

      var filespec = {pattern: '/tmp/*.wgt'};
      var stdout = 'young.wgt\nold.wgt';
      var expected = ['young.wgt', 'old.wgt'];

      mockSdbWrapper.expects('shell')
                    .withArgs(
                      'ls -1 -c ' + filespec.pattern,
                      sinon.match.instanceOf(Function)
                    )
                    .callsArgWith(1, null, stdout, '')
                    .once();

      bridge.listRemoteFiles(filespec, cb);

      cb.lastCall.args[1].should.eql(expected);
      mockSdbWrapper.verify();
    });

    it('should callback with first file in list if filter set to "latest"', function () {
      var cb = sinon.spy();

      var filespec = {pattern: '/tmp/*.wgt', filter: 'latest'};
      var stdout = 'young.wgt\nold.wgt';
      var expected = ['young.wgt'];

      mockSdbWrapper.expects('shell')
                    .withArgs(
                      'ls -1 -c ' + filespec.pattern,
                      sinon.match.instanceOf(Function)
                    )
                    .callsArgWith(1, null, stdout, '')
                    .once();

      bridge.listRemoteFiles(filespec, cb);

      cb.lastCall.args[1].should.eql(expected);
      mockSdbWrapper.verify();
    });
  });

  describe('getDestination()', function () {
    it('should join basename of local file to remote directory', function () {
      var localFile = 'build/package.wgt';
      var remoteDir = '/home/developer/';
      var expectedRemotePath = '/home/developer/package.wgt';
      bridge.getDestination(localFile, remoteDir).should.eql(expectedRemotePath);
    });
  });

  describe('pushRaw()', function () {
    var localFile = 'build/package.wgt';
    var remotePath = '/home/developer/package.wgt';

    it('should callback with no arguments if sdb push successful', function () {
      var cb = sinon.spy();

      mockSdbWrapper.expects('push')
                    .withArgs(
                      localFile,
                      remotePath,
                      sinon.match.instanceOf(Function)
                    )
                    .callsArgWith(2, null, '', '')
                    .once();

      bridge.pushRaw(localFile, remotePath, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockSdbWrapper.verify();
    });

    it('should callback with error thrown by sdb push', function () {
      var cb = sinon.spy();
      var err = new Error();

      mockSdbWrapper.expects('push')
                    .withArgs(
                      localFile,
                      remotePath,
                      sinon.match.instanceOf(Function)
                    )
                    .callsArgWith(2, err, '', '')
                    .once();

      bridge.pushRaw(localFile, remotePath, cb);

      cb.calledWith(err).should.be.true;
      mockSdbWrapper.verify();
    });

    it('should callback with error if sdb stderr indicates ' +
       'that push failed, even if exit code is good', function () {
      var cb = sinon.spy();

      mockSdbWrapper.expects('push')
                    .withArgs(
                      localFile,
                      remotePath,
                      sinon.match.instanceOf(Function)
                    )
                    .callsArgWith(2, null, '', 'failed to copy')
                    .once();

      mockSdbWrapper.expects('push')
                    .withArgs(
                      localFile,
                      remotePath,
                      sinon.match.instanceOf(Function)
                    )
                    .callsArgWith(2, null, '', 'cannot stat')
                    .once();

      bridge.pushRaw(localFile, remotePath, cb);
      cb.calledWith(sinon.match.instanceOf(Error)).should.be.true;
      cb.reset();

      bridge.pushRaw(localFile, remotePath, cb);
      cb.calledWith(sinon.match.instanceOf(Error)).should.be.true;

      mockSdbWrapper.verify();
    });
  });

  describe('pushOne()', function () {
    var localFile = 'build/package.wgt';
    var remoteDir = '/home/developer/';
    var expectedRemotePath = '/home/developer/package.wgt';

    it('should callback with no arguments if overwrite false, ' +
       'no chmod, file doesn\'t exist and push succeeds', function () {
      var overwrite = false;
      var chmod = null;
      var cb = sinon.spy();

      mockBridge.expects('getDestination')
                .withArgs(localFile, remoteDir)
                .returns(expectedRemotePath)
                .once();
      mockBridge.expects('fileExists')
                .withArgs(expectedRemotePath, sinon.match.instanceOf(Function))
                .callsArgWith(1, null, false)
                .once();
      mockBridge.expects('pushRaw')
                .withArgs(
                  localFile,
                  expectedRemotePath,
                  cb
                )
                .callsArg(2)
                .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
    });

    it('should log warning and invoke callback if overwrite false, ' +
       'no chmod, and file exists', function () {
      var overwrite = false;
      var chmod = null;
      var cb = sinon.spy();

      var loggerMock = sinon.mock(logger);
      loggerMock.expects('warn').once();

      mockBridge.expects('getDestination')
                .withArgs(localFile, remoteDir)
                .returns(expectedRemotePath)
                .once();
      mockBridge.expects('fileExists')
                .withArgs(expectedRemotePath, sinon.match.instanceOf(Function))
                .callsArgWith(1, null, true)
                .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod, cb);

      // cb invoked once with no arguments
      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);

      loggerMock.verify();
      mockBridge.verify();
    });

    it('should callback with error if overwrite true, no chmod, ' +
       'but push fails', function () {
      var overwrite = true;
      var chmod = null;
      var cb = sinon.spy();

      mockBridge.expects('getDestination')
                .withArgs(localFile, remoteDir)
                .returns(expectedRemotePath)
                .once();
      mockBridge.expects('pushRaw')
                .withArgs(
                  localFile,
                  expectedRemotePath,
                  cb
                )
                .callsArgWith(2, new Error())
                .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod, cb);

      // cb invoked once with error
      cb.calledOnce.should.be.true;
      cb.calledWith(sinon.match.instanceOf(Error)).should.be.true;

      mockBridge.verify();
    });

    it('should callback with error if overwrite false and the fileExists() ' +
       'check throws an error', function () {
      var overwrite = false;
      var chmod = null;
      var cb = sinon.spy();

      mockBridge.expects('getDestination')
                .withArgs(localFile, remoteDir)
                .returns(expectedRemotePath)
                .once();
      mockBridge.expects('fileExists')
                .withArgs(expectedRemotePath, sinon.match.instanceOf(Function))
                .callsArgWith(1, new Error())
                .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod, cb);

      // cb invoked once with error
      cb.calledOnce.should.be.true;
      cb.calledWith(sinon.match.instanceOf(Error)).should.be.true;

      mockBridge.verify();
    });

    it('should run chmod on pushed file if chmod argument supplied', function () {
      var overwrite = true;
      var chmod = '+x';
      var cb = sinon.spy();

      mockBridge.expects('getDestination')
                .withArgs(localFile, remoteDir)
                .returns(expectedRemotePath)
                .once();
      mockBridge.expects('pushRaw')
                .withArgs(
                  localFile,
                  expectedRemotePath,
                  sinon.match.instanceOf(Function)
                )
                .callsArg(2)
                .once();
      mockBridge.expects('chmod')
                .withArgs(expectedRemotePath, chmod, cb)
                .callsArg(2)
                .once();

      bridge.pushOne(localFile, remoteDir, overwrite, chmod, cb);

      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
    });
  });

  describe('push()', function () {
    it('should callback with error if local files can\'t be listed', function () {
      var stub = sinon.stub(fileLister, 'list');
      var err = new Error();
      stub.callsArgWith(1, err);

      var cb = sinon.spy();

      bridge.push('build/*.wgt', '/home/developer', true, '+x', cb);

      cb.calledWith(err).should.be.true;
      stub.restore();
    });

    it('should callback with an error if any push fails', function () {
      // stub out the file lister to return two file names
      var stub = sinon.stub(fileLister, 'list');
      var localFiles = ['build/one.wgt', 'build/two.wgt'];
      stub.callsArgWith(1, null, localFiles);

      // mock out the pushes so that the second push fails
      var err = new Error();

      mockBridge.expects('pushOne')
                .withArgs(
                  'build/one.wgt',
                  '/home/developer',
                  true,
                  '+x',
                  sinon.match.instanceOf(Function)
                )
                .callsArg(4)
                .once();

      // second push fails
      mockBridge.expects('pushOne')
                .withArgs(
                  'build/two.wgt',
                  '/home/developer',
                  true,
                  '+x',
                  sinon.match.instanceOf(Function)
                )
                .callsArgWith(4, err)
                .once();

      // call under test
      var cb = sinon.spy();

      bridge.push('build/*.wgt', '/home/developer', true, '+x', cb);

      // check expectations
      cb.calledWith(err).should.be.true;
      mockBridge.verify();
      stub.restore();
    });

    it('should callback with no arguments if all local files are pushed', function () {
      // stub out the file lister to return two file names
      var stub = sinon.stub(fileLister, 'list');
      var localFiles = ['build/one.wgt', 'build/two.wgt'];
      stub.callsArgWith(1, null, localFiles);

      // mock out the pushes so that the second push fails
      var err = new Error();

      mockBridge.expects('pushOne')
                .withArgs(
                  'build/one.wgt',
                  '/home/developer',
                  true,
                  '+x',
                  sinon.match.instanceOf(Function)
                )
                .callsArg(4)
                .once();

      // second push fails
      mockBridge.expects('pushOne')
                .withArgs(
                  'build/two.wgt',
                  '/home/developer',
                  true,
                  '+x',
                  sinon.match.instanceOf(Function)
                )
                .callsArgWith(4)
                .once();

      // call under test
      var cb = sinon.spy();

      bridge.push('build/*.wgt', '/home/developer', true, '+x', cb);

      // check expectations
      cb.calledOnce.should.be.true;
      expect(cb.lastCall.args.length).to.equal(0);
      mockBridge.verify();
      stub.restore();
    });
  });
});
