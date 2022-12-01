class Utils {
    debug = false;

    setDebugOutput(bool)
    {
        return bool ? console.log : () => {};
    }

    isUndefined(tof)
    {
        return (undefined === tof);
    }

    getProp(device, prop, returnValue)
    {
        if (undefined !== prop)
        {
            return device[prop];
        }
        return returnValue;
    }

    setProp()
    {

    }
};

module.exports = new Utils();